const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../database/db');
const { capitalize } = require('../utils/embeds');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('List your owned cards')
    .addUserOption((opt) => opt.setName('trainer').setDescription('Whose collection to view'))
    .addIntegerOption((opt) => opt.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction) {
    const target = interaction.options.getUser('trainer') || interaction.user;
    const page = interaction.options.getInteger('page') || 1;
    const offset = (page - 1) * PAGE_SIZE;

    const total = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE owner_id = ?').get(target.id).n;
    const rows = db
      .prepare(
        `SELECT cards.*, species.name AS species_name, species.rarity
         FROM cards JOIN species ON species.id = cards.species_id
         WHERE owner_id = ? ORDER BY cards.id DESC LIMIT ? OFFSET ?`
      )
      .all(target.id, PAGE_SIZE, offset);

    if (rows.length === 0) {
      return interaction.reply({
        content: page === 1 ? `${target.username} has no cards yet — try \`/openpack\`.` : 'No cards on that page.',
        ephemeral: true,
      });
    }

    const lines = rows.map((c) => {
      const star = c.is_shiny ? '✨ ' : '';
      const deckTag = c.in_deck_slot ? ' [in deck]' : '';
      return `${star}**#${c.id}** ${capitalize(c.species_name)} — Lv.${c.level} — ${c.rarity}${deckTag}`;
    });

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const embed = new EmbedBuilder()
      .setTitle(`${target.username}'s Collection (${total} cards)`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${page}/${totalPages} • /card <id> for full details` })
      .setColor(0x3498db);

    await interaction.reply({ embeds: [embed] });
  },
};
