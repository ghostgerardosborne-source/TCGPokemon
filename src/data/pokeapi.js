const fetch = require('node-fetch');
const { db } = require('../database/db');
const { rarityForDexId } = require('./rarity');

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days — base stats never change

const STAT_KEY_MAP = {
  hp: 'base_hp',
  attack: 'base_atk',
  defense: 'base_def',
  'special-attack': 'base_spa',
  'special-defense': 'base_spd',
  speed: 'base_spe',
};

function getCachedSpecies(dexId) {
  return db.prepare('SELECT * FROM species WHERE id = ?').get(dexId);
}

// Fetches a species from PokeAPI and upserts it into our local cache.
// Returns the cached row. Throws if the dex id doesn't exist.
async function fetchAndCacheSpecies(dexId) {
  const cached = getCachedSpecies(dexId);
  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) return cached;

  const res = await fetch(`${POKEAPI_BASE}/pokemon/${dexId}`);
  if (!res.ok) throw new Error(`PokeAPI returned ${res.status} for dex id ${dexId}`);
  const data = await res.json();

  const stats = { base_hp: 0, base_atk: 0, base_def: 0, base_spa: 0, base_spd: 0, base_spe: 0 };
  let evYieldStat = 'hp';
  let evYieldAmount = 1;
  for (const s of data.stats) {
    const col = STAT_KEY_MAP[s.stat.name];
    if (col) stats[col] = s.base_stat;
    if (s.effort > 0) {
      evYieldStat = s.stat.name;
      evYieldAmount = s.effort;
    }
  }

  const types = data.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);

  const row = {
    id: dexId,
    name: data.name,
    sprite_url: data.sprites?.front_default || null,
    shiny_sprite_url: data.sprites?.front_shiny || null,
    type1: types[0] || null,
    type2: types[1] || null,
    ...stats,
    ev_yield_stat: evYieldStat,
    ev_yield_amount: evYieldAmount,
    rarity: rarityForDexId(dexId),
    cached_at: Date.now(),
  };

  db.prepare(`
    INSERT INTO species (id, name, sprite_url, shiny_sprite_url, type1, type2,
      base_hp, base_atk, base_def, base_spa, base_spd, base_spe,
      ev_yield_stat, ev_yield_amount, rarity, cached_at)
    VALUES (@id, @name, @sprite_url, @shiny_sprite_url, @type1, @type2,
      @base_hp, @base_atk, @base_def, @base_spa, @base_spd, @base_spe,
      @ev_yield_stat, @ev_yield_amount, @rarity, @cached_at)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, sprite_url=excluded.sprite_url, shiny_sprite_url=excluded.shiny_sprite_url,
      type1=excluded.type1, type2=excluded.type2,
      base_hp=excluded.base_hp, base_atk=excluded.base_atk, base_def=excluded.base_def,
      base_spa=excluded.base_spa, base_spd=excluded.base_spd, base_spe=excluded.base_spe,
      ev_yield_stat=excluded.ev_yield_stat, ev_yield_amount=excluded.ev_yield_amount,
      rarity=excluded.rarity, cached_at=excluded.cached_at
  `).run(row);

  return getCachedSpecies(dexId);
}

// Warms the local cache for a range of dex ids (e.g. Gen 1: 1-151) so pack
// opens never block on a network call. Run this once via scripts/seed.js.
async function warmCache(startId = 1, endId = 151, onProgress = () => {}) {
  for (let id = startId; id <= endId; id++) {
    await fetchAndCacheSpecies(id);
    onProgress(id, endId);
    // Be polite to the free public API.
    await new Promise((r) => setTimeout(r, 150));
  }
}

module.exports = { fetchAndCacheSpecies, getCachedSpecies, warmCache };
