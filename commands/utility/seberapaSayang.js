const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('seberapa-sayang-kamu')
		.setDescription('Cek seberapa sayang bot ke kamu dari 1 sampai 10'),

	async execute(interaction) {
		// if (interaction.user.id === '516605670145916931') {
		// 	return interaction.reply(`Mas Rusdi Sayang Kamu ${interaction.user} 50000 / 10 💖`);
		// }
		const value = Math.floor(Math.random() * 10) + 1;
		await interaction.reply(`Aku sayang ${interaction.user} **${value}/10** 💖`);
	},
};
