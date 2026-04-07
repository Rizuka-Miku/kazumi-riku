const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('seberapa-sayang-kamu')
		.setDescription('Cek seberapa sayang bot ke kamu dari 1 sampai 10'),

	async execute(interaction) {
		// if (interaction.user.id === process.env.BARRY_USER_ID) {
		// 	const responses = [
		// 		`Mas Rusdi Sayang Kamu ${interaction.user} 50000 / 10 💖`,
		// 		`Mas Hambali Sayang Kamu ${interaction.user} 100000 / 10 💖💖`,
		// 		`Buna Teddy Sayang Kamu ${interaction.user} 999999 / 10 💖💖💖`,
		// 	];
		// 	return interaction.reply(responses[Math.floor(Math.random() * responses.length)]);
		// }
		const value = Math.floor(Math.random() * 10) + 1;
		await interaction.reply(`Aku sayang ${interaction.user} **${value}/10** 💖`);
	},
};
