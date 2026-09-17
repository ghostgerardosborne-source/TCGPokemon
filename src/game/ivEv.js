const config = require('../config');

// Rolls a fresh set of IVs (0-31 per stat) for a newly pulled card — this
// is what makes two copies of the same species meaningfully different,
// exactly like catching the "same" Pokemon twice in the real games.
function rollIvs() {
  const roll = () => Math.floor(Math.random() * (config.maxIv + 1));
  return {
    iv_hp: roll(), iv_atk: roll(), iv_def: roll(),
    iv_spa: roll(), iv_spd: roll(), iv_spe: roll(),
  };
}

// Official stat formulas (nature multiplier omitted for now — see README
// for how to add natures later without a schema change, we already store
// everything else needed).
function calcHp(base, iv, ev, level) {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}
function calcOtherStat(base, iv, ev, level) {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
}

// Computes a card's full battle-ready stat line from its species base
// stats + this individual card's IVs/EVs/level.
function computeStats(species, card) {
  const level = card.level;
  return {
    hp: calcHp(species.base_hp, card.iv_hp, card.ev_hp, level),
    atk: calcOtherStat(species.base_atk, card.iv_atk, card.ev_atk, level),
    def: calcOtherStat(species.base_def, card.iv_def, card.ev_def, level),
    spa: calcOtherStat(species.base_spa, card.iv_spa, card.ev_spa, level),
    spd: calcOtherStat(species.base_spd, card.iv_spd, card.ev_spd, level),
    spe: calcOtherStat(species.base_spe, card.iv_spe, card.ev_spe, level),
  };
}

// Grants EVs to a card for defeating a given opponent species, respecting
// the real caps: 252 per stat, 510 total across all six.
// Returns the clamped { statKey, amountGranted } actually applied.
function grantEvs(card, defeatedSpecies) {
  const statMap = {
    hp: 'ev_hp', attack: 'ev_atk', defense: 'ev_def',
    'special-attack': 'ev_spa', 'special-defense': 'ev_spd', speed: 'ev_spe',
  };
  const col = statMap[defeatedSpecies.ev_yield_stat] || 'ev_hp';
  const yieldAmount = defeatedSpecies.ev_yield_amount || 1;

  const currentTotal = card.ev_hp + card.ev_atk + card.ev_def + card.ev_spa + card.ev_spd + card.ev_spe;
  const roomTotal = config.maxTotalEv - currentTotal;
  const roomStat = config.maxStatEv - card[col];
  const granted = Math.max(0, Math.min(yieldAmount, roomTotal, roomStat));

  card[col] += granted;
  return { statKey: col, amountGranted: granted };
}

module.exports = { rollIvs, computeStats, grantEvs };
