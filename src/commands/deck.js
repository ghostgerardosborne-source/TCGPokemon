const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { db } = require('../database/db');
const { capitalize } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deck')
    .setDescription('Manage your battle deck')
    .addSubcommand((sub) => sub.setName('view').setDescription('View your current deck'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a card to your deck')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Card ID').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a card from your deck')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Card ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'view') {
      const rows = db
        .prepare(
          `SELECT cards.*, species.name AS species_name FROM cards
           JOIN species ON species.id = cards.species_id
           WHERE owner_id = ? AND in_deck_slot IS NOT NULL ORDER BY in_deck_slot`
        )
        .all(userId);
      if (rows.length === 0) {
        return interaction.reply({ content: 'Your deck is empty. Add cards with `/deck add <id>`.', ephemeral: true });
      }
      const lines = rows.map((c) => `${c.in_deck_slot}. ${c.is_shiny ? '✨ ' : ''}${capitalize(c.species_name)} (#${c.id}) — Lv.${c.level}`);
      const embed = new EmbedBuilder().setTitle(`${interaction.user.username}'s Battle Deck`).setDescription(lines.join('\n')).setColor(0x3498db);
      return interaction.reply({ embeds: [embed] });
    }

    const cardId = interaction.options.getInteger('id');
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND owner_id = ?').get(cardId, userId);
    if (!card) return interaction.reply({ content: `You don't own a card with ID #${cardId}.`, ephemeral: true });

    if (sub === 'add') {
      if (card.in_deck_slot) return interaction.reply({ content: 'That card is already in your deck.', ephemeral: true });
      const used = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE owner_id = ? AND in_deck_slot IS NOT NULL').get(userId).n;
      if (used >= config.maxDeckSize) {
        return interaction.reply({ content: `Your deck is full (max ${config.maxDeckSize}). Remove a card first.`, ephemeral: true });
      }
      db.prepare('UPDATE cards SET in_deck_slot = ? WHERE id = ?').run(used + 1, cardId);
      return interaction.reply(`Added **#${cardId}** to your deck (slot ${used + 1}).`);
    }

    if (sub === 'remove') {
      if (!card.in_deck_slot) return interaction.reply({ content: 'That card is not in your deck.', ephemeral: true });
      const removedSlot = card.in_deck_slot;
      db.prepare('UPDATE cards SET in_deck_slot = NULL WHERE id = ?').run(cardId);
      // Shift down slots after the removed one so the deck stays compact 1..n
      db.prepare(
        'UPDATE cards SET in_deck_slot = in_deck_slot - 1 WHERE owner_id = ? AND in_deck_slot > ?'
      ).run(userId, removedSlot);
      return interaction.reply(`Removed **#${cardId}** from your deck.`);
    }
  },
};
