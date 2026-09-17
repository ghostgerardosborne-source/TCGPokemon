const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { ensureUser } = require('../database/db');
const { openPack } = require('../game/packOpening');
const { capitalize } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('openpack')
    .setDescription(`Open a pack of ${config.cardsPerPack} cards for ${config.packCost} points`),

  async execute(interaction) {
    ensureUser(interaction.user.id);
    const result = openPack(interaction.user.id);

    if (result.error === 'not_enough_points') {
      return interaction.reply({
        content: `You need ${config.packCost} points to open a pack. Win battles with \`/battle\` to earn more.`,
        ephemeral: true,
      });
    }

    const lines = result.pulls.map((p) => {
      const star = p.is_shiny ? '✨ ' : '';
      return `${star}**${capitalize(p.species.name)}** (#${p.card_id}) — ${p.species.rarity} — IVs: ${p.iv_hp}/${p.iv_atk}/${p.iv_def}/${p.iv_spa}/${p.iv_spd}/${p.iv_spe}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} opened a pack!`)
      .setDescription(lines.join('\n'))
      .setColor(result.pulls.some((p) => p.is_shiny) ? 0xf1c40f : 0x3498db)
      .setFooter({ text: 'Use /card <id> to see full stats for any pull.' });

    await interaction.reply({ embeds: [embed] });
  },
};
