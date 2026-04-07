const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('apa-benar')
		.setDescription('Cek apakah Rizuka Miku berbohong atau tidak dengan jawaban benar atau salah secara acak'),

	async execute(interaction) {
		const options = ['Berbohong', 'Ragu', 'Jujur'];
		const value = options[Math.floor(Math.random() * options.length)];
		const message = value === 'Ragu' ? 'Aduh Rizuka Miku Ragu Nich' : `Rizuka Miku telah **${value}**`;
		await interaction.reply(message);
	},
};
