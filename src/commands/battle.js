const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');
const { makeFighter } = require('../game/battleEngine');
const { createSession } = require('../game/battleSession');
const { createChallenge } = require('../game/pendingChallenges');
const { getLeadFighter } = require('../game/deckHelpers');
const { battleEmbed, moveButtons } = require('../utils/battleUi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Battle with your deck lead')
    .addSubcommand((sub) => sub.setName('ai').setDescription('Practice battle against a wild AI opponent'))
    .addSubcommand((sub) =>
      sub
        .setName('challenge')
        .setDescription('Challenge another trainer to a battle')
        .addUserOption((opt) => opt.setName('opponent').setDescription('Who to challenge').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const lead = getLeadFighter(userId);
    if (!lead) {
      return interaction.reply({
        content: 'You need a card in deck slot 1 first. Use `/deck add <id>`.',
        ephemeral: true,
      });
    }
    const { card: myCard, species: mySpecies } = lead;

    if (sub === 'ai') {
      const wildSpeciesRow = db.prepare('SELECT * FROM species ORDER BY RANDOM() LIMIT 1').get();
      if (!wildSpeciesRow) {
        return interaction.reply({ content: 'Species cache is empty — ask the bot owner to run the seed script.', ephemeral: true });
      }
      const { rollIvs } = require('../game/ivEv');
      const wildCard = {
        id: -1,
        level: myCard.level,
        is_shiny: Math.floor(Math.random() * 4096) === 0,
        ev_hp: 0, ev_atk: 0, ev_def: 0, ev_spa: 0, ev_spd: 0, ev_spe: 0,
        ...rollIvs(),
      };

      const fighterA = makeFighter({ side: 'A', userId, card: myCard, species: mySpecies });
      const fighterB = makeFighter({ side: 'B', userId: null, card: wildCard, species: wildSpeciesRow });
      const session = createSession({ fighterA, fighterB, isAi: true, channelId: interaction.channelId });

      await interaction.reply({
        embeds: [battleEmbed(session)],
        components: [moveButtons(session.id, 'A', fighterA)],
      });
      return;
    }

    if (sub === 'challenge') {
      const opponent = interaction.options.getUser('opponent');
      if (opponent.id === userId) {
        return interaction.reply({ content: "You can't challenge yourself.", ephemeral: true });
      }
      const opponentLead = getLeadFighter(opponent.id);
      if (!opponentLead) {
        return interaction.reply({ content: `${opponent.username} doesn't have a card in deck slot 1 yet.`, ephemeral: true });
      }

      const challengeId = createChallenge({ challengerId: userId, opponentId: opponent.id, channelId: interaction.channelId });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`challenge:${challengeId}:accept`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`challenge:${challengeId}:decline`).setLabel('Decline').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `${opponent}, <@${userId}> has challenged you to a battle! Deck leads: **${mySpecies.name}** vs your lead.`,
        components: [row],
      });
      return;
    }
  },
};
