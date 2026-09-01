// commands/utility/hangman.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const words = require('../../constants/hangmanWords.js');

// Game state storage (could move to separate file if needed)
const activeGames = new Map();

const getMikuImage = (wrongGuesses) => {
	const stages = ['01', '02', '03', '04', '05', '06', '07'];
	const index = Math.min(wrongGuesses, stages.length - 1);
	return `https://rizuka-miku.github.io/teka-teki-wota/miku-${stages[index]}.png`;
};

async function displayHangman(interaction, gameState, page) {
	const { word, guessedLetters, wrongGuesses, maxWrongGuesses, shownHints } = gameState;
	const currentPage = page !== undefined ? page : gameState.currentPage || 1;
	gameState.currentPage = currentPage;

	const isButtonInteraction = interaction.isButton && interaction.isButton();

	if (!isButtonInteraction && !interaction.deferred && !interaction.replied) {
		try {
			await interaction.deferReply({ ephemeral: false });
		}
		catch (err) {
			console.error('Failed to defer reply:', err);
		}
	}

	const wordDisplay = word.split('').map(char =>
		char === ' ' ? '   ' : (guessedLetters.includes(char) ? char : '\\_'),
	).join(' ');

	const embed = new EmbedBuilder()
		.setTitle('💖 Teka Teki Wota 💖')
		.setDescription(`**${wordDisplay}**`)
		.setColor('#39C5BB')
		.setImage(getMikuImage(wrongGuesses))
		.addFields(
			{ name: 'Wrong Guesses', value: `${wrongGuesses}/${maxWrongGuesses}`, inline: true },
			{ name: 'Used Letters', value: guessedLetters.join(', ') || 'None', inline: true },
			{ name: 'Lives', value: '💖 '.repeat(maxWrongGuesses - wrongGuesses) || '💔' },
		);

	if (shownHints.length > 0) {
		const hintText = shownHints.map((hint, index) => `${index + 1}. ${hint}`).join('\n');
		embed.addFields({ name: `💡 Hint (${shownHints.length}/${gameState.hintList.length})`, value: hintText });
	}

	const fullAlphabet = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
	const half = Math.ceil(fullAlphabet.length / 2);
	const currentLetters = currentPage === 1 ? fullAlphabet.slice(0, half) : fullAlphabet.slice(half);

	const rows = [];
	for (let i = 0; i < currentLetters.length; i += 5) {
		const row = new ActionRowBuilder();
		const chunk = currentLetters.slice(i, i + 5);
		chunk.forEach(letter => {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`hangman_${letter}`)
					.setLabel(letter)
					.setStyle(guessedLetters.includes(letter) ? ButtonStyle.Secondary : ButtonStyle.Primary)
					.setDisabled(guessedLetters.includes(letter)),
			);
		});
		rows.push(row);
	}

	const controlRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('hangman_hint')
			.setLabel('Show Hint')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(shownHints.length >= gameState.hintList.length || gameState.hintList.length === 0),

		new ButtonBuilder()
			.setCustomId('hangman_reset')
			.setLabel('New Game')
			.setStyle(ButtonStyle.Danger),

		new ButtonBuilder()
			.setCustomId(currentPage === 1 ? 'hangman_page2' : 'hangman_page1')
			.setLabel(currentPage === 1 ? 'Next Letters' : 'Previous Letters')
			.setStyle(ButtonStyle.Primary),
	);

	rows.push(controlRow);

	try {
		if (isButtonInteraction) {
			await interaction.update({ embeds: [embed], components: rows });
		}
		else {
			const reply = await interaction.editReply({ embeds: [embed], components: rows });
			gameState.messageId = reply.id;
		}
	}
	catch (err) {
		console.error('Failed to respond to interaction:', err);
	}
}


module.exports = {
	data: new SlashCommandBuilder()
		.setName('teka-teki-wota')
		.setDescription('Memulai permainan teka-teki wota'),

	activeGames,
	displayHangman,

	async execute(interaction) {
		const randomWord = words.songs[Math.floor(Math.random() * words.songs.length)];
		const gameState = {
			word: randomWord.title.toUpperCase(),
			hintList: randomWord.hint,
			shownHints: [],
			guessedLetters: [],
			wrongGuesses: 0,
			maxWrongGuesses: 6,
			currentPage: 1,
			ownerId: interaction.user.id,
		};

		activeGames.set(`${interaction.channelId}_${interaction.user.id}`, gameState);
		await displayHangman(interaction, gameState);
	},
	getMikuImage,
};