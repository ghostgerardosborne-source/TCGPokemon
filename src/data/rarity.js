// Simple rarity assignment by dex id band. Swap this out for a curated
// list (or a `rarity` column you hand-edit in the DB) once you know which
// generations/species you're actually including.
const LEGENDARY_IDS = new Set([
  144, 145, 146, 150, 151, // Gen 1 birds + Mew/Mewtwo
  243, 244, 245, 249, 250, 251, // Gen 2 legendaries
]);

function rarityForDexId(id) {
  if (LEGENDARY_IDS.has(id)) return 'legendary';
  if (id % 10 === 0) return 'rare';
  if (id % 3 === 0) return 'uncommon';
  return 'common';
}

// Weighted odds for what a single card slot in a pack pulls.
// Shiny is rolled independently on top of whichever species/rarity is picked.
const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 27,
  rare: 10,
  legendary: 3,
};

module.exports = { rarityForDexId, RARITY_WEIGHTS };
