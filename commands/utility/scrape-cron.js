#!/usr/bin/env node
require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');

const selector = process.env.SCRAPE_SELECTOR || '.entry-news__list--item';
const url = process.env.SCRAPE_URL || 'http://jkt48.com/news/list?lang=id';

console.log('scrape-cron: scheduling daily run (@daily)');

cron.schedule('@daily', () => {
	console.log(new Date().toISOString(), 'Running scheduled scrape');
	const child = spawn(process.execPath, ['commands/utility/scrape.js', selector, url], { stdio: 'inherit' });
	child.on('close', code => console.log('scrape process exited with code', code));
}, { scheduled: true });

// keep process alive
console.log('scrape-cron: waiting for scheduled tasks...');
