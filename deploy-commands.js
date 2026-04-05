const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const commands = [];
const folderPath = path.join(__dirname, 'commands');
const commandFolder = fs.readdirSync(folderPath);

for (const folder of commandFolder) {
	const commandPath = path.join(folderPath, folder);
	const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
			console.log(`Loaded command: ${command.data.name}`);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
		}
	}
}

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// Deploy to specific guild (instant updates)
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	}
	catch (error) {
		console.error(error);
	}
})();
