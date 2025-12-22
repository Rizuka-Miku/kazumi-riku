#!/usr/bin/env node
require('dotenv').config();
const puppeteer = require('puppeteer');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_TEST_ID;

if (!TOKEN || !CHANNEL_ID) {
	console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_TEST_ID in .env');
	process.exit(1);
}

(async () => {
	const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'], slowMo: 50 });
	const page = await browser.newPage();

	let inflight = 0;
	const onRequest = () => {
		inflight++;
	};
	const onRequestDone = () => {
		inflight = Math.max(0, inflight - 1);
	};
	page.on('request', onRequest);
	page.on('requestfinished', onRequestDone);
	page.on('requestfailed', onRequestDone);

	const selector = process.argv[2] || '.entry-news__list--item';
	const url = process.argv[3] || 'http://jkt48.com/news/list?lang=id';
	await page.goto(url, { waitUntil: 'domcontentloaded' });

	// wait until load event fired
	await page.evaluate(() => new Promise(resolve => {
		if (document.readyState === 'complete') {
			resolve();
			return;
		}
		window.addEventListener('load', () => resolve(), { once: true });
	}));

	// wait for network to be idle (no inflight requests for 500ms), timeout after 10s
	await new Promise(resolve => {
		const maxTimeout = setTimeout(() => cleanup() || resolve(), 10000);
		let idleTimer = null;
		function check() {
			if (inflight === 0) {
				if (!idleTimer) {
					idleTimer = setTimeout(() => cleanup() || resolve(), 500);
				}
			}
			else if (idleTimer) {
				clearTimeout(idleTimer);
				idleTimer = null;
			}
		}
		function cleanup() {
			clearTimeout(maxTimeout);
			if (idleTimer) {
				clearTimeout(idleTimer);
				idleTimer = null;
			}
			page.off('request', onRequest);
			page.off('requestfinished', onRequestDone);
			page.off('requestfailed', onRequestDone);
		}
		page.on('request', check);
		page.on('requestfinished', check);
		page.on('requestfailed', check);
		check();
	});

	// now collect text and href from items
	const data = await page.$$eval(selector, items => items.map(el => {
		const text = el.innerText.trim();
		let href = '';
		try {
			const a = (el.querySelector && el.querySelector('a')) || (el.closest && el.closest('a')) || null;
			if (a && a.href) href = a.href;
		}
		catch {
			href = '';
		}
		if (!href) {
			const dataHref = el.getAttribute && (el.getAttribute('data-href') || el.getAttribute('data-url'));
			if (dataHref) href = dataHref;
		}
		return { text, href };
	}));

	// serialized element details for debugging (attributes, outerHTML, tagName, href)
	const elementsDetail = await page.$$eval(selector, items => items.map(el => ({
		tagName: el.tagName,
		innerText: el.innerText.trim(),
		href: (el.querySelector && el.querySelector('a') && el.querySelector('a').href) || '',
		outerHTML: el.outerHTML,
		attributes: Array.from(el.attributes || []).map(a => ({ name: a.name, value: a.value })),
	})));

	console.log('elements detail (first 5):', JSON.stringify(elementsDetail.slice(0, 5), null, 2));


	console.log('scraped items count:', Array.isArray(data) ? data.length : 0);
	console.log('scraped items preview:', data.slice(0, 3));
	console.log('outer html preview:', elementsDetail[0] ? elementsDetail[0].outerHTML.slice(0, 200) : 'N/A');

	await browser.close();

	const client = new Client({ intents: [GatewayIntentBits.Guilds] });

	client.once('ready', async () => {
		try {
			const channel = await client.channels.fetch(CHANNEL_ID);
			if (!channel || typeof channel.send !== 'function') {
				console.error('Channel not found or cannot send messages to it');
				await client.destroy();
				process.exit(1);
			}

			let content = '';
			if (Array.isArray(data) && data.length > 0) {
				const latest = data.slice(0, 1);
				const parts = latest.map((d, index) => `- ${index + 1}. ${d.text}${d.href ? '\n' + d.href : ''}`);
				content = `Latest news:\n${parts.join('\n\n')}`;
			}
			else {
				content = 'No scraped items found at the target URL.';
			}

			console.log('sending content preview:', content.split('\n').slice(0, 10).join('\n'));
			await channel.send({ content });
			console.log('Message sent to channel', CHANNEL_ID);
		}
		catch (err) {
			console.error('Failed to send message:', err);
		}
		finally {
			await client.destroy();
			process.exit(0);
		}
	});

	client.login(TOKEN).catch(err => {
		console.error('Discord login failed:', err);
		process.exit(1);
	});
})();
