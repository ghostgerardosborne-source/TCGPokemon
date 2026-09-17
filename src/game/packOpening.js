const config = require('../config');
const { db } = require('../database/db');
const { RARITY_WEIGHTS } = require('../data/rarity');
const { rollIvs } = require('./ivEv');

function weightedRarityPick() {
  const entries = Object.entries(RARITY_WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return entries[0][0];
}

function pickSpeciesByRarity(rarity) {
  const rows = db.prepare('SELECT * FROM species WHERE rarity = ?').all(rarity);
  if (rows.length === 0) {
    // Fall back to any cached species if this rarity tier is empty
    // (e.g. cache not fully warmed yet for legendaries).
    const any = db.prepare('SELECT * FROM species ORDER BY RANDOM() LIMIT 1').get();
    if (!any) throw new Error('Species cache is empty — run `node scripts/seed.js` first.');
    return any;
  }
  return rows[Math.floor(Math.random() * rows.length)];
}

// Opens one pack for a user: deducts points, pulls config.cardsPerPack
// cards with independent rarity + shiny rolls, inserts them as owned
// cards with freshly rolled IVs, and returns the pulled rows (species +
// card joined) for rendering.
function openPack(discordId) {
  const spent = require('../database/db').spendPoints(discordId, config.packCost);
  if (!spent) return { error: 'not_enough_points' };

  const pulls = [];
  const insertCard = db.prepare(`
    INSERT INTO cards (owner_id, species_id, is_shiny, level,
      iv_hp, iv_atk, iv_def, iv_spa, iv_spd, iv_spe, obtained_at)
    VALUES (@owner_id, @species_id, @is_shiny, @level,
      @iv_hp, @iv_atk, @iv_def, @iv_spa, @iv_spd, @iv_spe, @obtained_at)
  `);

  const tx = db.transaction(() => {
    for (let i = 0; i < config.cardsPerPack; i++) {
      const rarity = weightedRarityPick();
      const species = pickSpeciesByRarity(rarity);
      const isShiny = Math.floor(Math.random() * config.shinyOdds) === 0;
      const ivs = rollIvs();

      const info = insertCard.run({
        owner_id: discordId,
        species_id: species.id,
        is_shiny: isShiny ? 1 : 0,
        level: 5,
        obtained_at: Date.now(),
        ...ivs,
      });

      pulls.push({ card_id: info.lastInsertRowid, species, is_shiny: isShiny, ...ivs });
    }
    db.prepare('UPDATE users SET packs_opened = packs_opened + 1 WHERE discord_id = ?').run(discordId);
  });
  tx();

  return { pulls };
}

module.exports = { openPack };
