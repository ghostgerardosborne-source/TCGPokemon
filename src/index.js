const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
require('./database/db'); // ensures schema is created on boot

const { handleChallengeButton, handleMoveButton } = require('./components/battleButtons');
const { handleTradeButton } = require('./components/tradeButtons');

if (!config.token) {
  console.error('Missing DISCORD_TOKEN in your .env file. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}. ${client.commands.size} commands loaded.`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const [namespace, ...parts] = interaction.customId.split(':');

      if (namespace === 'challenge') {
        const [challengeId, action] = parts;
        return handleChallengeButton(interaction, challengeId, action);
      }

      if (namespace === 'battle') {
        const [sessionId, side, moveIndex] = parts;
        return handleMoveButton(interaction, sessionId, side, parseInt(moveIndex, 10));
      }

      if (namespace === 'trade') {
        const [tradeId, action] = parts;
        return handleTradeButton(interaction, parseInt(tradeId, 10), action);
      }
    }
  } catch (err) {
    console.error('Error handling interaction:', err);
    const payload = { content: 'Something went wrong handling that — please try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(config.token);
