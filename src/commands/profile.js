const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureUser, db } = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("View your (or another trainer's) profile")
    .addUserOption((opt) => opt.setName('trainer').setDescription('Whose profile to view')),

  async execute(interaction) {
    const target = interaction.options.getUser('trainer') || interaction.user;
    const user = ensureUser(target.id);
    const cardCount = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE owner_id = ?').get(target.id).n;
    const shinyCount = db
      .prepare('SELECT COUNT(*) AS n FROM cards WHERE owner_id = ? AND is_shiny = 1')
      .get(target.id).n;

    const embed = new EmbedBuilder()
      .setTitle(`${target.username}'s Trainer Card`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x3498db)
      .addFields(
        { name: 'Points', value: String(user.points), inline: true },
        { name: 'Record', value: `${user.battles_won}W - ${user.battles_lost}L`, inline: true },
        { name: 'Packs Opened', value: String(user.packs_opened), inline: true },
        { name: 'Cards Owned', value: String(cardCount), inline: true },
        { name: 'Shinies', value: String(shinyCount), inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
