const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, ensureUser } = require('../database/db');
const { capitalize } = require('../utils/embeds');

function parseIds(str) {
  return [...new Set(str.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n)))];
}

function describeCards(ids) {
  if (ids.length === 0) return '*nothing*';
  const rows = db
    .prepare(
      `SELECT cards.id, cards.is_shiny, species.name FROM cards
       JOIN species ON species.id = cards.species_id
       WHERE cards.id IN (${ids.map(() => '?').join(',')})`
    )
    .all(...ids);
  return rows.map((r) => `${r.is_shiny ? '✨ ' : ''}${capitalize(r.name)} (#${r.id})`).join(', ') || '*nothing*';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Propose a trade with another trainer')
    .addUserOption((opt) => opt.setName('with').setDescription('Trainer to trade with').setRequired(true))
    .addStringOption((opt) => opt.setName('offer').setDescription('Your card IDs, comma-separated (e.g. 12,15)').setRequired(true))
    .addStringOption((opt) => opt.setName('request').setDescription("Their card IDs you want, comma-separated").setRequired(true)),

  async execute(interaction) {
    const partner = interaction.options.getUser('with');
    const fromId = interaction.user.id;
    const toId = partner.id;

    if (fromId === toId) return interaction.reply({ content: "You can't trade with yourself.", ephemeral: true });

    const offeredIds = parseIds(interaction.options.getString('offer'));
    const requestedIds = parseIds(interaction.options.getString('request'));
    if (offeredIds.length === 0 || requestedIds.length === 0) {
      return interaction.reply({ content: 'Provide at least one card ID on each side.', ephemeral: true });
    }

    // Ownership validation up front, so a bad trade can't even be proposed.
    const owned = db
      .prepare(`SELECT id FROM cards WHERE owner_id = ? AND id IN (${offeredIds.map(() => '?').join(',')})`)
      .all(fromId, ...offeredIds)
      .map((r) => r.id);
    const missingOwn = offeredIds.filter((id) => !owned.includes(id));
    if (missingOwn.length > 0) {
      return interaction.reply({ content: `You don't own card(s): ${missingOwn.join(', ')}`, ephemeral: true });
    }
    const theirs = db
      .prepare(`SELECT id FROM cards WHERE owner_id = ? AND id IN (${requestedIds.map(() => '?').join(',')})`)
      .all(toId, ...requestedIds)
      .map((r) => r.id);
    const missingTheirs = requestedIds.filter((id) => !theirs.includes(id));
    if (missingTheirs.length > 0) {
      return interaction.reply({ content: `${partner.username} doesn't own card(s): ${missingTheirs.join(', ')}`, ephemeral: true });
    }

    ensureUser(fromId);
    ensureUser(toId);
    const info = db
      .prepare(
        `INSERT INTO trades (from_user, to_user, offered_card_ids, requested_card_ids, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .run(fromId, toId, JSON.stringify(offeredIds), JSON.stringify(requestedIds), Date.now());

    const embed = new EmbedBuilder()
      .setTitle(`Trade Offer #${info.lastInsertRowid}`)
      .setColor(0x9b59b6)
      .addFields(
        { name: `${interaction.user.username} offers`, value: describeCards(offeredIds) },
        { name: `In exchange for (${partner.username}'s cards)`, value: describeCards(requestedIds) }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade:${info.lastInsertRowid}:accept`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade:${info.lastInsertRowid}:decline`).setLabel('Decline').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`trade:${info.lastInsertRowid}:cancel`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ content: `${partner}, you have a trade offer!`, embeds: [embed], components: [row] });
  },
};
