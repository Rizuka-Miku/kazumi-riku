const { Client, GatewayIntentBits, Events, Collection, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const hangmanCommand = require('./commands/utility/hangman');

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Load commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }
}

// Game cleanup interval (1 hour timeout)
setInterval(() => {
  const now = Date.now();
  for (const [key, game] of hangmanCommand.activeGames) {
    if (now - game.createdAt > 3600000) {
      hangmanCommand.activeGames.delete(key);
    }
  }
}, 60000);

client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash command handler
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Hangman buttons
    if (interaction.isButton() && interaction.customId.startsWith('hangman_')) {
      await interaction.deferUpdate(); // Acknowledge interaction immediately

      const gameKey = `${interaction.channelId}_${interaction.user.id}`;
      const gameState = hangmanCommand.activeGames.get(gameKey);
      const action = interaction.customId.split('_')[1];

      // Page switching
      if (action === 'page1' || action === 'page2') {
        if (!gameState) {
          return interaction.followUp({
            content: 'No active game! Start a new one with `/teka-teki-wota`',
            ephemeral: true
          });
        }
        const page = action === 'page1' ? 1 : 2;
        return hangmanCommand.displayHangman(interaction, gameState, page);
      }

      // Game must exist for other actions
      if (!gameState) {
        return interaction.followUp({
          content: 'No active game! Start a new one with `/teka-teki-wota`',
          ephemeral: true
        });
      }

      // Hint
      if (action === 'hint') {
        if (!gameState.currentHint && gameState.hintList.length > 0) {
          gameState.currentHint = gameState.hintList[Math.floor(Math.random() * gameState.hintList.length)];
          hangmanCommand.activeGames.set(gameKey, gameState);
        }
        return hangmanCommand.displayHangman(interaction, gameState);
      }

      // Reset
      if (action === 'reset') {
        hangmanCommand.activeGames.delete(gameKey);
        return hangmanCommand.execute(interaction);
      }

      // Letter guess
      const letter = action.toUpperCase();
      if (gameState.guessedLetters.includes(letter)) {
        return interaction.followUp({ 
          content: 'You already guessed that letter!', 
          ephemeral: true 
        });
      }

      gameState.guessedLetters.push(letter);
      if (!gameState.word.includes(letter)) {
        gameState.wrongGuesses++;
      }

      // Win/Lose condition
      const isWinner = gameState.word.split('').every(
        char => char === ' ' || gameState.guessedLetters.includes(char)
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

        await interaction.editReply({ embeds: [resultEmbed], components: [] });
        return hangmanCommand.activeGames.delete(gameKey);
      }

      hangmanCommand.activeGames.set(gameKey, gameState);
      return hangmanCommand.displayHangman(interaction, gameState);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error processing this interaction!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error processing this interaction!',
        ephemeral: true
      });
    }
  }
});

client.once(Events.ClientReady, async client => {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  try {
    // Register commands globally
    const commands = [];
    client.commands.forEach(cmd => commands.push(cmd.data.toJSON()));
    await client.application.commands.set(commands);
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('error', console.error);
process.on('unhandledRejection', console.error);

client.login(token);