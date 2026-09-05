const { Client, GatewayIntentBits, Events, Collection, MessageFlags, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const hangmanCommand = require('./commands/utility/hangman');
const tanyaMikuCommand = require('./commands/utility/tanyaMiku');

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.commands = new Collection();

const folderPath = path.join(__dirname, 'commands');
const commandFolder = fs.readdirSync(folderPath);

for (const folder of commandFolder) {
	const commandPath = path.join(folderPath, folder);
	const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandPath, file);
		const command = require(filePath);

		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
			console.log(`Loaded command: ${command.data.name} from ${filePath}`);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
		}
	}
}

client.on(Events.InteractionCreate, async interaction => {
	try {
		// Slash command handler
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if (!command) return;
			await command.execute(interaction);
			return;
		}

		// Miku room close button
		if (interaction.isButton() && interaction.customId === 'mikuroom_close') {
			return tanyaMikuCommand.closeRoom(interaction);
		}

		// Hangman buttons
		if (interaction.isButton() && interaction.customId.startsWith('hangman_')) {
			const gameState = hangmanCommand.activeGames.get(`${interaction.channelId}_${interaction.user.id}`);
			const action = interaction.customId.split('_')[1];

			// Check if user is clicking their own game message
			if (gameState && gameState.messageId && gameState.messageId !== interaction.message.id && action !== 'reset') {
				return interaction.reply({
					content: 'This is not your game! Start your own with `/teka-teki-wota`',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Check if user is the game owner (except for reset which anyone can use to start their own game)
			if (gameState && gameState.ownerId !== interaction.user.id && action !== 'reset') {
				return interaction.reply({
					content: 'This is not your game! Start your own with `/teka-teki-wota`',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Page switching (doesn't require active game state)
			if (action === 'page1' || action === 'page2') {
				if (!gameState) {
					return interaction.reply({
						content: 'No active game! Start a new one with `/teka-teki-wota`',
						flags: MessageFlags.Ephemeral,
					});
				}
				const page = action === 'page1' ? 1 : 2;
				gameState.currentPage = page;
				hangmanCommand.activeGames.set(`${interaction.channelId}_${interaction.user.id}`, gameState);
				return hangmanCommand.displayHangman(interaction, gameState, page);
			}

			// Game must exist for everything else (except reset)
			if (!gameState && action !== 'reset') {
				return interaction.reply({
					content: 'No active game! Start a new one with `/teka-teki-wota`',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Hint
			if (action === 'hint') {
				if (gameState.shownHints.length < gameState.hintList.length) {
					// Get hints that haven't been shown yet
					const remainingHints = gameState.hintList.filter(hint => !gameState.shownHints.includes(hint));
					if (remainingHints.length > 0) {
						const newHint = remainingHints[Math.floor(Math.random() * remainingHints.length)];
						gameState.shownHints.push(newHint);
					}
				}
				return hangmanCommand.displayHangman(interaction, gameState);
			}

			// Reset
			if (action === 'reset') {
				hangmanCommand.activeGames.delete(`${interaction.channelId}_${interaction.user.id}`);
				return hangmanCommand.execute(interaction);
			}

			// Letter guess
			const letter = action.toUpperCase();
			if (gameState.guessedLetters.includes(letter)) {
				return interaction.reply({ content: 'You already guessed that letter!', flags: MessageFlags.Ephemeral });
			}

			gameState.guessedLetters.push(letter);
			if (!gameState.word.includes(letter)) {
				gameState.wrongGuesses++;
			}

			// Win/Lose condition
			const isWinner = gameState.word.split('').every(
				char => char === ' ' || gameState.guessedLetters.includes(char),
			);
			const isGameOver = gameState.wrongGuesses >= gameState.maxWrongGuesses;

			if (isWinner || isGameOver) {
				const resultEmbed = new EmbedBuilder()
					.setTitle(isWinner ? '🎉 You Win! 🎉' : '💔 Game Over 💔')
					.setDescription(isWinner
						? 'Ternyata kamu cukup berwawasan~💖'
						: `Jawabannya adalah: **${gameState.word}**\nTernyata hanya segitu saja kemampuanmu anak muda!!!`)
					.setColor(isWinner ? '#39C5BB' : '#FF0000')
					.setImage(hangmanCommand.getMikuImage(isWinner ? 0 : gameState.maxWrongGuesses));

				await interaction.update({ embeds: [resultEmbed], components: [] });
				return hangmanCommand.activeGames.delete(`${interaction.channelId}_${interaction.user.id}`);
			}

			hangmanCommand.activeGames.set(`${interaction.channelId}_${interaction.user.id}`, gameState);
			return hangmanCommand.displayHangman(interaction, gameState);
		}
	}
	catch (error) {
		console.error('Error handling interaction:', error);
		const errorReply = {
			content: 'There was an error processing this interaction!',
			flags: MessageFlags.Ephemeral,
		};

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(errorReply);
		}
		else {
			try {
				await interaction.reply(errorReply);
			}
			catch {
				// Interaction token expired — nothing we can do
			}
		}
	}
});


client.on(Events.MessageCreate, message => tanyaMikuCommand.handleRoomMessage(message));

client.on(Events.ThreadDelete, thread => tanyaMikuCommand.rooms.delete(thread.id));

client.on('error', console.error);
process.on('unhandledRejection', console.error);

client.once(Events.ClientReady, async clientReady => {
	console.log(`Ready! logged in as ${clientReady.user.tag}`);

	try {
		// Register commands globally
		const commands = [];
		client.commands.forEach(command => commands.push(command.data.toJSON()));

		await client.application.commands.set(commands);
		console.log('Successfully registered application commands.');
		console.log('Registered commands:', commands.map(c => c.name).join(', '));
	}
	catch (error) {
		console.error('Error registering commands:', error);
	}
});

client.login(token);