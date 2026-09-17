const { db } = require('../database/db');

async function handleTradeButton(interaction, tradeId, action) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });
  if (trade.status !== 'pending') {
    return interaction.reply({ content: `This trade was already ${trade.status}.`, ephemeral: true });
  }

  if (action === 'cancel') {
    if (interaction.user.id !== trade.from_user) {
      return interaction.reply({ content: 'Only the trade proposer can cancel it.', ephemeral: true });
    }
    db.prepare("UPDATE trades SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(Date.now(), tradeId);
    return interaction.update({ content: 'Trade cancelled.', components: [] });
  }

  if (interaction.user.id !== trade.to_user) {
    return interaction.reply({ content: 'Only the recipient can accept or decline this trade.', ephemeral: true });
  }

  if (action === 'decline') {
    db.prepare("UPDATE trades SET status = 'declined', resolved_at = ? WHERE id = ?").run(Date.now(), tradeId);
    return interaction.update({ content: 'Trade declined.', components: [] });
  }

  // action === 'accept' — re-validate ownership at accept time (cards may
  // have moved since the offer was made) and transfer atomically.
  const offeredIds = JSON.parse(trade.offered_card_ids);
  const requestedIds = JSON.parse(trade.requested_card_ids);

  const stillOwnedByFrom = db
    .prepare(`SELECT COUNT(*) AS n FROM cards WHERE owner_id = ? AND id IN (${offeredIds.map(() => '?').join(',')})`)
    .get(trade.from_user, ...offeredIds).n;
  const stillOwnedByTo = db
    .prepare(`SELECT COUNT(*) AS n FROM cards WHERE owner_id = ? AND id IN (${requestedIds.map(() => '?').join(',')})`)
    .get(trade.to_user, ...requestedIds).n;

  if (stillOwnedByFrom !== offeredIds.length || stillOwnedByTo !== requestedIds.length) {
    db.prepare("UPDATE trades SET status = 'declined', resolved_at = ? WHERE id = ?").run(Date.now(), tradeId);
    return interaction.update({ content: 'Trade fell through — one of the cards changed hands since this offer was made.', components: [] });
  }

  const tx = db.transaction(() => {
    const reassign = db.prepare('UPDATE cards SET owner_id = ?, in_deck_slot = NULL WHERE id = ?');
    for (const id of offeredIds) reassign.run(trade.to_user, id);
    for (const id of requestedIds) reassign.run(trade.from_user, id);
    db.prepare("UPDATE trades SET status = 'accepted', resolved_at = ? WHERE id = ?").run(Date.now(), tradeId);
  });
  tx();

  await interaction.update({ content: '✅ Trade complete! Cards have swapped owners (removed from any battle decks).', components: [] });
}

module.exports = { handleTradeButton };
