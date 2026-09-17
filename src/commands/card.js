const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../database/db');
const { cardEmbed } = require('../utils/embeds');
const { computeStats } = require('../game/ivEv');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('View full details for one of your cards')
    .addIntegerOption((opt) => opt.setName('id').setDescription('Card ID').setRequired(true)),

  async execute(interaction) {
    const cardId = interaction.options.getInteger('id');
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    if (!card) return interaction.reply({ content: `No card with ID #${cardId}.`, ephemeral: true });

    const species = db.prepare('SELECT * FROM species WHERE id = ?').get(card.species_id);
    const stats = computeStats(species, card);

    const embed = cardEmbed({ species, card });
    embed.addFields({
      name: 'Battle Stats (Lv. ' + card.level + ')',
      value: `HP ${stats.hp} · Atk ${stats.atk} · Def ${stats.def} · SpA ${stats.spa} · SpD ${stats.spd} · Spe ${stats.spe}`,
    });
    embed.addFields({ name: 'Owner', value: `<@${card.owner_id}>`, inline: true });

    await interaction.reply({ embeds: [embed] });
  },
};
