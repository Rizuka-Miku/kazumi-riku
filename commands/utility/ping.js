const { SlashCommandBuilder } = require('discord.js');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies Halo!'),
	async execute(interaction) {
		await interaction.reply('Halo Kak!');
	},
};