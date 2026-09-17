const { db } = require('../database/db');

// Returns { card, species } for the card in deck slot 1, or null.
function getLeadFighter(userId) {
  const row = db
    .prepare(
      `SELECT cards.id AS card_id, cards.*, species.id AS species_id
       FROM cards JOIN species ON species.id = cards.species_id
       WHERE owner_id = ? AND in_deck_slot = 1`
    )
    .get(userId);
  if (!row) return null;

  const card = {
    id: row.card_id,
    owner_id: row.owner_id,
    species_id: row.species_id,
    nickname: row.nickname,
    is_shiny: row.is_shiny,
    level: row.level,
    xp: row.xp,
    iv_hp: row.iv_hp, iv_atk: row.iv_atk, iv_def: row.iv_def, iv_spa: row.iv_spa, iv_spd: row.iv_spd, iv_spe: row.iv_spe,
    ev_hp: row.ev_hp, ev_atk: row.ev_atk, ev_def: row.ev_def, ev_spa: row.ev_spa, ev_spd: row.ev_spd, ev_spe: row.ev_spe,
    in_deck_slot: row.in_deck_slot,
  };
  const species = db.prepare('SELECT * FROM species WHERE id = ?').get(row.species_id);
  return { card, species };
}

module.exports = { getLeadFighter };
