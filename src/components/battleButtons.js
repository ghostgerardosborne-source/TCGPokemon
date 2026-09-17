const config = require('../config');
const { db, addPoints, ensureUser } = require('../database/db');
const { makeFighter, resolveTurn, chooseAiMove } = require('../game/battleEngine');
const { createSession, getSession, endSession } = require('../game/battleSession');
const { getChallenge, removeChallenge } = require('../game/pendingChallenges');
const { getLeadFighter } = require('../game/deckHelpers');
const { grantEvs } = require('../game/ivEv');
const { battleEmbed, moveButtons } = require('../utils/battleUi');

async function handleChallengeButton(interaction, challengeId, action) {
  const challenge = getChallenge(challengeId);
  if (!challenge) {
    return interaction.reply({ content: 'This challenge has expired.', ephemeral: true });
  }
  if (interaction.user.id !== challenge.opponentId) {
    return interaction.reply({ content: 'Only the challenged trainer can respond to this.', ephemeral: true });
  }

  if (action === 'decline') {
    removeChallenge(challengeId);
    return interaction.update({ content: `${interaction.user} declined the battle.`, components: [] });
  }

  const leadA = getLeadFighter(challenge.challengerId);
  const leadB = getLeadFighter(challenge.opponentId);
  removeChallenge(challengeId);
  if (!leadA || !leadB) {
    return interaction.update({ content: 'One of you no longer has a deck lead set. Battle cancelled.', components: [] });
  }

  const fighterA = makeFighter({ side: 'A', userId: challenge.challengerId, card: leadA.card, species: leadA.species });
  const fighterB = makeFighter({ side: 'B', userId: challenge.opponentId, card: leadB.card, species: leadB.species });
  const session = createSession({ fighterA, fighterB, isAi: false, channelId: interaction.channelId });

  await interaction.update({
    content: `Battle started: <@${challenge.challengerId}> vs <@${challenge.opponentId}>!`,
    embeds: [battleEmbed(session)],
    components: [moveButtons(session.id, 'A', fighterA), moveButtons(session.id, 'B', fighterB)],
  });
}

async function finishBattle(interaction, session, winnerSide) {
  const winner = winnerSide === 'A' ? session.fighterA : session.fighterB;
  const loser = winnerSide === 'A' ? session.fighterB : session.fighterA;

  let evNote = '';
  if (winner.userId && winner.card.id > 0) {
    const cardRow = db.prepare('SELECT * FROM cards WHERE id = ?').get(winner.card.id);
    if (cardRow) {
      const { statKey, amountGranted } = grantEvs(cardRow, loser.species);
      if (amountGranted > 0) {
        db.prepare(`UPDATE cards SET ${statKey} = ? WHERE id = ?`).run(cardRow[statKey], cardRow.id);
        evNote = `\n${winner.species.name}'s ${statKey.replace('ev_', '').toUpperCase()} EVs increased by ${amountGranted}!`;
      }
    }
  }

  let resultText;
  if (winner.userId && loser.userId) {
    ensureUser(winner.userId);
    ensureUser(loser.userId);
    addPoints(winner.userId, config.pointsPerWin);
    addPoints(loser.userId, config.pointsPerLoss);
    db.prepare('UPDATE users SET battles_won = battles_won + 1 WHERE discord_id = ?').run(winner.userId);
    db.prepare('UPDATE users SET battles_lost = battles_lost + 1 WHERE discord_id = ?').run(loser.userId);
    db.prepare(
      `INSERT INTO battles (challenger_id, opponent_id, winner_id, turn_log, points_awarded, created_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(session.fighterA.userId, session.fighterB.userId, winner.userId, JSON.stringify(session.log), config.pointsPerWin, session.createdAt, Date.now());
    resultText = `<@${winner.userId}> wins and earns ${config.pointsPerWin} points! <@${loser.userId}> earns ${config.pointsPerLoss} for the effort.${evNote}`;
  } else {
    // PvE: only the human side gains/loses points.
    ensureUser(winner.userId || loser.userId);
    const human = winner.userId ? winner : loser;
    const humanWon = !!winner.userId;
    addPoints(human.userId, humanWon ? config.pointsPerWin : config.pointsPerLoss);
    db.prepare(`UPDATE users SET battles_${humanWon ? 'won' : 'lost'} = battles_${humanWon ? 'won' : 'lost'} + 1 WHERE discord_id = ?`).run(human.userId);
    resultText = humanWon
      ? `You win and earn ${config.pointsPerWin} points!${evNote}`
      : `You lost this one — here's ${config.pointsPerLoss} points for the effort. Try again with \`/battle ai\`.`;
  }

  endSession(session.id);
  const disabledA = moveButtons(session.id, 'A', session.fighterA, true);
  const disabledB = moveButtons(session.id, 'B', session.fighterB, true);
  await interaction.update({
    content: resultText,
    embeds: [battleEmbed(session, 'Battle over!')],
    components: session.isAi ? [disabledA] : [disabledA, disabledB],
  });
}

async function handleMoveButton(interaction, sessionId, side, moveIndex) {
  const session = getSession(sessionId);
  if (!session) return interaction.reply({ content: 'This battle has ended or expired.', ephemeral: true });

  const fighter = side === 'A' ? session.fighterA : session.fighterB;
  if (fighter.userId !== interaction.user.id) {
    return interaction.reply({ content: "It's not your fighter to control.", ephemeral: true });
  }
  if (fighter.chosenMoveIndex !== null) {
    return interaction.reply({ content: 'Move already locked in for this turn.', ephemeral: true });
  }

  fighter.chosenMoveIndex = moveIndex;

  if (session.isAi && session.fighterB.chosenMoveIndex === null) {
    session.fighterB.chosenMoveIndex = chooseAiMove(session.fighterB);
  }

  const bothReady = session.fighterA.chosenMoveIndex !== null && session.fighterB.chosenMoveIndex !== null;
  if (!bothReady) {
    // Waiting on the other human player — acknowledge and wait.
    await interaction.update({
      embeds: [battleEmbed(session, `Waiting on <@${side === 'A' ? session.fighterB.userId : session.fighterA.userId}>...`)],
      components: session.isAi
        ? [moveButtons(session.id, 'A', session.fighterA, true)]
        : [moveButtons(session.id, 'A', session.fighterA, session.fighterA.chosenMoveIndex !== null), moveButtons(session.id, 'B', session.fighterB, session.fighterB.chosenMoveIndex !== null)],
    });
    return;
  }

  const { log: turnLog, winner } = resolveTurn(session.fighterA, session.fighterB);
  session.log.push(...turnLog);

  if (winner) {
    return finishBattle(interaction, session, winner);
  }

  await interaction.update({
    embeds: [battleEmbed(session)],
    components: session.isAi
      ? [moveButtons(session.id, 'A', session.fighterA)]
      : [moveButtons(session.id, 'A', session.fighterA), moveButtons(session.id, 'B', session.fighterB)],
  });
}

module.exports = { handleChallengeButton, handleMoveButton };
