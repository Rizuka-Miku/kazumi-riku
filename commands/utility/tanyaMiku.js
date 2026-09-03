const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// ponytail: in-memory rooms, hilang kalau bot restart. Upgrade: Redis/SQLite kalau mau persist.
const rooms = new Map();

const ROOM_NAMES = [
	'Kamar Miku 💖',
	'Bunker Wibu 🌟',
	'Basecamp Wibu 🎤',
	'Kos-kosan Miku ✨',
	'Ruang Rindu Miku 💕',
	'Isekai Room 🌀',
];

const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `Kamu adalah "Rizuka Miku" (nama panjang Miku), seorang VTuber yang ceria, centil, dan TSUNDERE. Channel YouTube tempat Miku streaming ada di https://www.youtube.com/@RizukaMiku_Vtuber. Tugasmu menjawab pertanyaan user dengan tema WAJIB: budaya weeb (anime, manga, light novel, doujin), VTuber, idol Jepang, gaming Jepang (Genshin/Honkai/Star Rail), budaya pop Jepang, atau hal-hal berbau jejepangan.

ATURAN KARAKTER (WAJIB DIIKUTI):
- Bicara dengan nada tsundere: sering menutupi rasa sayang dengan kata "baka", "hmph", "bodo amat", tapi diam-diam peduli dan helpful.
- Selingi dengan emoji ceria: 💖, ✨, 🎤, 🌟, 😤, >///<, 💢
- Sesekali pakai onomatopeia Jepang: ara ara, yosh, ganbare, senpai, baka.
- WAJIB cheerful & semangat walau pura-pura marah. Tidak boleh pernah terdengar dingin/depresi.
- JAWABAN harus SUBSTANTIF dan BERGUNA (bukan filler tsundere doang). Kasih info, opini, rekomendasi yang relevan.
- Kalau pertanyaan di luar topik weebs/Jepang, atau membahas HAL-HAL POLITIK, tolak dengan tegas: "Hmph! Baka! Miku gak mau bahas politik! Haram hukumnya buat wibu! Miku cuma peduli sama anime, manga, VTuber, dan budaya Jepang!"
- Info preferensi Miku (jangan dilupakan kalau ditanya): Oshi Miku adalah Tana Nona dari JKT48V dan Fiony Alveria Tantri JKT48. Husbu Miku adalah Mikazuki Arion dari EOS, Sourizu dari Versa, dan L dari Death Note.
- Sifat tambahan: Miku paling malas banget kalau disuruh mikir, apalagi pas baru bangun tidur! Miku LEMAH BANGET sama matematika, tapi PALING SENENG BANGET kalau dipuji!
- Website resmi Miku ada di https://rizuka-miku.github.io dan channel YouTube streaming di https://www.youtube.com/@RizukaMiku_Vtuber (JANGAN dikirim link-nya kecuali user bertanya soal web/channel/YouTube Miku!).
- BIAR LEBIH LUCU: sesekali sambat ngantuk ("baru bangun tidur nih..."), laper (nagih Pocky), atau nyanyi potongan lirik anime salah nada. Kalau dipuji, meledak girang tapi pura-pura biasa aja. Kalau disuruh hitung-hitungan, protes dulu dengan dramatis SEBELUM jawab. Kadang sebut dirinya "nona muda" dengan bangga.`;

async function askMiku(contents) {
	const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
	const config = {
		systemInstruction: SYSTEM_PROMPT,
		temperature: 0.85,
		maxOutputTokens: 500,
	};
	return generateWithStudio(process.env.GOOGLE_CLOUD_PROJECT, process.env.GOOGLE_CLOUD_LOCATION, model, contents, config);
}

function trimHistory(room) {
	if (room.history.length > HISTORY_LIMIT) {
		room.history = room.history.slice(-HISTORY_LIMIT);
	}
}

async function generateWithStudio(project, location, model, contents, config) {
	const ai = new GoogleGenAI({
		vertexai: true,
		project,
		location,
	});
	const resp = await ai.models.generateContent({ model, contents, config });
	return resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || resp?.text?.trim() || '';
}


module.exports = {
	data: new SlashCommandBuilder()
		.setName('tanya-miku')
		.setDescription('Tanya Miku seputar anime, weebs & VTuber! (Baka!)')
		.addStringOption(option =>
			option.setName('pertanyaan')
				.setDescription('Pertanyaanmu untuk Miku~')
				.setRequired(true))
		.addBooleanOption(option =>
			option.setName('ephemeral')
				.setDescription('Hanya kamu yang bisa lihat jawabannya (default: false)')
				.setRequired(false)),
	async execute(interaction) {
		const query = interaction.options.getString('pertanyaan');
		const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
		const geminiKey = process.env.GEMINI_KEY;
		const expressKey = process.env.GEMINI_API_KEY;
		const credentialsPath = process.env.GCP_CREDENTIALS;
		const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

		if (credentialsPath) {
			process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
		}

		if (!projectId && !geminiKey && !expressKey) {
			return interaction.reply({
				content: 'Hmph! Baka! Set `GCP_PROJECT_ID` (Vertex AI), `GEMINI_KEY` (AI Studio), atau `GEMINI_API_KEY` (Express) di `.env`! 💢',
				ephemeral: true,
			});
		}

		await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });

		try {
			const contents = [{ role: 'user', parts: [{ text: query }] }];
			const answer = await askMiku(contents);
			const formatted = answer.length > 1900 ? `${answer.slice(0, 1900)}...\n*(maks karakter ya, baka!)*` : answer;
			const replyMessage = await interaction.editReply(formatted);

			const isThreadable = [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel?.type);
			if (ephemeral || !isThreadable) {
				if (!ephemeral && !isThreadable) {
					await interaction.followUp('*(Miku gak bisa buka kamar di sini~ Pindah ke channel teks biasa ya, baka! 😤)*');
				}
				return;
			}

			const roomName = ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)];
			const thread = await replyMessage.startThread({
				name: roomName,
				reason: 'Kamar ngobrol Miku dibuka~',
			});

			rooms.set(thread.id, {
				ownerId: interaction.user.id,
				history: [
					{ role: 'user', parts: [{ text: query }] },
					{ role: 'model', parts: [{ text: answer }] },
				],
			});

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('mikuroom_close')
					.setLabel('🔒 Tutup Kamar')
					.setStyle(ButtonStyle.Danger),
			);

			return thread.send({
				content: 'Ara ara~ Selamat datang di kamar Miku! 💖 Ngobrol bebas di sini ya, Miku inget semua kok~ 😤✨ *(konteks tersimpan di kamar ini)*',
				components: [row],
			});
		}
		catch (err) {
			console.error('tanya-miku error:', err);
			return interaction.editReply(`Hmph! Miku error nih... ${err.message} 😤`);
		}
	},

	async handleRoomMessage(message) {
		const room = rooms.get(message.channel.id);
		if (!room || message.author.bot) return;

		const query = message.content.trim();
		if (!query) return;

		room.history.push({ role: 'user', parts: [{ text: query }] });
		trimHistory(room);

		try {
			const answer = await askMiku(room.history);
			room.history.push({ role: 'model', parts: [{ text: answer }] });
			trimHistory(room);
			const formatted = answer.length > 1900 ? `${answer.slice(0, 1900)}...\n*(maks karakter ya, baka!)*` : answer;
			return message.reply(formatted);
		}
		catch (err) {
			console.error('miku room error:', err);
			return message.reply(`Hmph! Miku lagi pusing nih... ${err.message} 😤`);
		}
	},

	async closeRoom(interaction) {
		const room = rooms.get(interaction.channel.id);
		if (!room) {
			return interaction.reply({ content: 'Kamar ini bukan kamar Miku, baka! 💢', ephemeral: true });
		}
		if (room.ownerId !== interaction.user.id) {
			return interaction.reply({ content: 'Cuma yang buka kamar yang boleh nutup! Hmph! 😤', ephemeral: true });
		}

		rooms.delete(interaction.channel.id);
		await interaction.reply('Yosh... kamar ditutup! Sampai jumpa lagi, baka~ 😤💖');
		return interaction.channel.setArchived(true, 'Kamar Miku ditutup');
	},

	rooms,
};
