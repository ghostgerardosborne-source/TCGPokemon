const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { capitalize } = require('./embeds');

function hpBar(current, max, length = 12) {
  const filled = Math.max(0, Math.round((current / max) * length));
  return '█'.repeat(filled) + '░'.repeat(length - filled) + `  ${current}/${max}`;
}

function fighterLabel(fighter) {
  const who = fighter.userId ? `<@${fighter.userId}>` : 'Wild opponent';
  const star = fighter.card.is_shiny ? '✨ ' : '';
  return `${who} — ${star}${capitalize(fighter.species.name)} (Lv.${fighter.card.level})`;
}

function battleEmbed(session, statusText) {
  const { fighterA, fighterB, log } = session;
  const recentLog = log.slice(-4).map(formatLogLine).join('\n') || 'Battle begins!';
  return new EmbedBuilder()
    .setTitle('⚔️ Battle')
    .setColor(0xe74c3c)
    .addFields(
      { name: fighterLabel(fighterA), value: hpBar(fighterA.currentHp, fighterA.maxHp) },
      { name: fighterLabel(fighterB), value: hpBar(fighterB.currentHp, fighterB.maxHp) },
      { name: 'Log', value: recentLog }
    )
    .setFooter({ text: statusText || 'Choose your move' });
}

function formatLogLine(entry) {
  if (entry.guard) return `Side ${entry.actor} used ${entry.move} and is guarding.`;
  if (entry.missed) return `Side ${entry.actor}'s ${entry.move} missed!`;
  const eff = entry.effectivenessMult > 1 ? ' (super effective!)' : entry.effectivenessMult < 1 && entry.effectivenessMult > 0 ? ' (not very effective)' : entry.effectivenessMult === 0 ? ' (no effect)' : '';
  return `Side ${entry.actor} used ${entry.move} for ${entry.damage} dmg${eff}`;
}

function moveButtons(sessionId, side, fighter, disabled = false) {
  const row = new ActionRowBuilder();
  fighter.moveset.forEach((move, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`battle:${sessionId}:${side}:${i}`)
        .setLabel(move.name)
        .setStyle(move.effect === 'guard' ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  });
  return row;
}

module.exports = { battleEmbed, moveButtons, hpBar, fighterLabel };
