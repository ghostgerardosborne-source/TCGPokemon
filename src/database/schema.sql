-- Species reference data, cached locally from PokeAPI so we don't hit
-- the network on every pack open / battle turn.
CREATE TABLE IF NOT EXISTS species (
  id INTEGER PRIMARY KEY,           -- PokeAPI national dex id
  name TEXT NOT NULL,
  sprite_url TEXT,
  shiny_sprite_url TEXT,
  type1 TEXT,
  type2 TEXT,
  base_hp INTEGER, base_atk INTEGER, base_def INTEGER,
  base_spa INTEGER, base_spd INTEGER, base_spe INTEGER,
  ev_yield_stat TEXT,               -- which stat this species grants EVs in when defeated
  ev_yield_amount INTEGER DEFAULT 1,
  rarity TEXT NOT NULL DEFAULT 'common', -- common | uncommon | rare | legendary
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 500,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  battles_won INTEGER NOT NULL DEFAULT 0,
  battles_lost INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Each row is one individual owned card, with its own rolled IVs (0-31 per
-- stat, fixed forever, like a real Pokemon) and trainable EVs (0-252 per
-- stat / 510 total, earned by winning battles).
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES users(discord_id),
  species_id INTEGER NOT NULL REFERENCES species(id),
  nickname TEXT,
  is_shiny INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 5,
  xp INTEGER NOT NULL DEFAULT 0,

  iv_hp INTEGER NOT NULL, iv_atk INTEGER NOT NULL, iv_def INTEGER NOT NULL,
  iv_spa INTEGER NOT NULL, iv_spd INTEGER NOT NULL, iv_spe INTEGER NOT NULL,

  ev_hp INTEGER NOT NULL DEFAULT 0, ev_atk INTEGER NOT NULL DEFAULT 0, ev_def INTEGER NOT NULL DEFAULT 0,
  ev_spa INTEGER NOT NULL DEFAULT 0, ev_spd INTEGER NOT NULL DEFAULT 0, ev_spe INTEGER NOT NULL DEFAULT 0,

  in_deck_slot INTEGER,             -- 1..maxDeckSize if currently in owner's battle deck, else NULL
  obtained_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner_id);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user TEXT NOT NULL REFERENCES users(discord_id),
  to_user TEXT NOT NULL REFERENCES users(discord_id),
  offered_card_ids TEXT NOT NULL,   -- JSON array of card ids
  requested_card_ids TEXT NOT NULL, -- JSON array of card ids
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id TEXT NOT NULL REFERENCES users(discord_id),
  opponent_id TEXT NOT NULL REFERENCES users(discord_id),
  winner_id TEXT,
  turn_log TEXT,                    -- JSON array of turn summaries
  points_awarded INTEGER,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
