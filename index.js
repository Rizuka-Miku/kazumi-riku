const {Client, GatewayIntentBits, Events, Collection} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

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
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);


    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        if(interaction.replied || interaction.deferred) {
            await interaction.followUp({content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral});
        } else {
            await interaction.reply({content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral})
        }
    }


})

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