const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { quizQuestions } = require('../../constants/quiz.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('quiz')
		.setDescription('Trivia quiz command'),
	async execute(interaction) {
		const question = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
		const buttons = [];

		for (let i = 0; i < question.options.length; i++) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`quiz_option_${i}`)
					.setLabel(question.options[i])
					.setStyle(ButtonStyle.Primary),
			);
		}

		const rows = [];
		for (let i = 0; i < buttons.length; i += 5) {
			rows.push(
				new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)),
			);
		}

		const response = await interaction.reply({ content: `**${question.question}**\n\u200B`, components: rows, fetchReply: true });

		const collector = response.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async i => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({ content: 'Sesi Ini bukan Sesimu ya anak muda!!', ephemeral: true });
			}

			const optionIndex = parseInt(i.customId.split('_')[2]);
			const selectedAnswer = question.options[optionIndex];

			if (selectedAnswer === question.answer) {
				await i.update({ content: `**${question.question}**\n\n✅ WIIIH JAWABANMU BENAR!!`, components: [] });
			}
			else {
				await i.update({ content: `**${question.question}**\n\n❌ Jawabanmu salah! DASAR KARBIT!!! `, components: [] });
			}

			collector.stop();
		});

		collector.on('end', collected => {
			if (collected.size === 0) {
				interaction.editReply({ content: `**${question.question}**\n\n⏱️ Waktu habis!`, components: [] });
			}
		});
	},
};