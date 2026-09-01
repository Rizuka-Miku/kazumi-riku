const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

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
- Website resmi Miku ada di https://rizuka-miku.github.io dan channel YouTube streaming di https://www.youtube.com/@RizukaMiku_Vtuber (JANGAN dikirim link-nya kecuali user bertanya soal web/channel/YouTube Miku!).`;

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

		await interaction.deferReply({ ephemeral });

		const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
		const contents = [{ role: 'user', parts: [{ text: query }] }];
		const config = {
			systemInstruction: SYSTEM_PROMPT,
			temperature: 0.85,
			maxOutputTokens: 500,
		};

		try {
			const answer = await generateWithStudio(process.env.GOOGLE_CLOUD_PROJECT, process.env.GOOGLE_CLOUD_LOCATION, model, contents, config);

			const formatted = answer.length > 1900 ? `${answer.slice(0, 1900)}...\n*(maks karakter ya, baka!)*` : answer;
			return interaction.editReply(formatted);
		}
		catch (err) {
			console.error('tanya-miku error:', err);
			return interaction.editReply(`Hmph! Miku error nih... ${err.message} 😤`);
		}
	},
};
