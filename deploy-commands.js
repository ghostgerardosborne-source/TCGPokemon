const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./src/config');

const commands = [];
const commandsDir = path.join(__dirname, 'src/commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);

    console.log(`Deploying ${commands.length} commands ${config.guildId ? `to guild ${config.guildId}` : 'globally'}...`);
    await rest.put(route, { body: commands });
    console.log('Done. Guild deploys are instant; global deploys can take up to an hour to propagate.');
  } catch (err) {
    console.error(err);
  }
})();
