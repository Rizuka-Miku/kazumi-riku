const {Client, GatewayIntentBits, Events, Collection, MessageFlags, EmbedBuilder} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const hangmanCommand = require('./commands/utility/hangman');

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

client.commands = new Collection();

const folderPath = path.join(__dirname, 'commands');
const commandFolder = fs.readdirSync(folderPath)

for (const folder of commandFolder) {
    const commandPath = path.join(folderPath, folder);
    const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
    for(const file of commandFiles) {
        const filePath = path.join(commandPath, file);
        const command = require(filePath);

        if('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`)
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
  
      // Hangman buttons
      if (interaction.isButton() && interaction.customId.startsWith('hangman_')) {
        const gameState = hangmanCommand.activeGames.get(`${interaction.channelId}_${interaction.user.id}`);
        const action = interaction.customId.split('_')[1];
  
        // Page switching (doesn't require active game state)
        if (action === 'page1' || action === 'page2') {
          if (!gameState) {
            return interaction.reply({
              content: 'No active game! Start a new one with `/teka-teki-wota`',
              flags: MessageFlags.Ephemeral
            });
          }
          const page = action === 'page1' ? 1 : 2;
          return hangmanCommand.displayHangman(interaction, gameState, page);
        }
  
        // Game must exist for everything else
        if (!gameState) {
          return interaction.reply({
            content: 'No active game! Start a new one with `/teka-teki-wota`',
            ephemeral: true
          });
        }
  
        // Hint
        if (action === 'hint') {
          if (!gameState.currentHint && gameState.hintList.length > 0) {
            gameState.currentHint = gameState.hintList[Math.floor(Math.random() * gameState.hintList.length)];
          }
          return hangmanCommand.displayHangman(interaction, gameState);
        }
  
        // Reset
        if (action === 'reset') {
          hangmanCommand.activeGames.delete(interaction.channelId);
          return hangmanCommand.execute(interaction);
        }
  
        // Letter guess
        const letter = action.toUpperCase();
        if (gameState.guessedLetters.includes(letter)) {
          return interaction.reply({ content: 'You already guessed that letter!', ephemeral: true });
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
  
          await interaction.update({ embeds: [resultEmbed], components: [] });
          return hangmanCommand.activeGames.delete(interaction.channelId);
        }
  
        hangmanCommand.activeGames.set(`${interaction.channelId}_${interaction.user.id}`, gameState);
        return hangmanCommand.displayHangman(interaction, gameState);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      const errorReply = {
        content: 'There was an error processing this interaction!',
        ephemeral: true
      };
  
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  });

client.once(Events.ClientReady, async clientReady => {
    console.log(`Ready! logged in as ${clientReady.user.tag}`)

    try {
        // Register commands globally
        const commands = [];
        client.commands.forEach(command => commands.push(command.data.toJSON()));
        
        await client.application.commands.set(commands);
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.login(token)