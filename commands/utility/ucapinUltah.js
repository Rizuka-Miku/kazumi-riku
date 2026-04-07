const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ucapin-ultah')
		.setDescription('Ucapkan selamat ulang tahun'),

	async execute(interaction) {
		await interaction.reply(`Selamat ulang tahun ${interaction.user}! 🎉`);
	},
};
