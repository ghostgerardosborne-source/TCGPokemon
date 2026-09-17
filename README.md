# Pokémon TCG Discord Bot

A fan-made Discord bot: open packs, pull cards with individually rolled IVs
(like catching the "same" Pokémon twice and getting different potential),
train EVs by winning turn-based battles, and trade cards with other players.

**Legal note:** Pokémon names, sprites, and data are pulled live from
[PokeAPI](https://pokeapi.co) (a free, open community API) and cached
locally — nothing is bundled or redistributed by this repo. All Pokémon
IP belongs to Nintendo/Game Freak/The Pokémon Company. This is an
unofficial fan project; be aware that similar projects have received
takedown requests in the past.

## Features

- `/openpack` — spend points to pull 5 cards, each with independently
  rolled IVs (0-31 per stat, fixed for that card's lifetime) and a shiny
  roll (1/512 by default, configurable).
- `/card <id>` — full stat sheet for one card: base stats × IVs × EVs ×
  level, using the real mainline stat formula.
- `/deck add|remove|view` — manage a battle deck (deck slot 1 = your
  lead, the card that actually fights).
- `/battle ai` — practice battle against a random wild opponent.
- `/battle challenge @user` — challenge another trainer; both sides pick
  moves each turn via buttons, faster Pokémon (by Speed stat) acts first.
- Winning a battle grants points **and** EVs to your lead card (capped at
  252/stat, 510 total, exactly like the real games) based on what species
  you defeated.
- `/trade` — propose a card-for-card(s) swap; the other trainer accepts
  or declines via buttons, with ownership re-validated atomically at
  accept time.
- `/profile`, `/collection` — trainer stats and paginated card list.

## Setup

1. **Create a Discord application & bot**
   at https://discord.com/developers/applications → New Application →
   Bot tab → Reset Token (copy it) → OAuth2 → URL Generator, check
   `bot` + `applications.commands` scopes and `Send Messages`,
   `Embed Links`, `Use Slash Commands` permissions, then invite the bot
   to your server with the generated URL.

2. **Install dependencies**
   ```
   npm install
   ```

3. **Configure environment**
   ```
   cp .env.example .env
   ```
   Fill in `DISCORD_TOKEN` (bot token) and `DISCORD_CLIENT_ID`
   (application id, also on the Discord dev portal). Optionally set
   `DISCORD_GUILD_ID` to your test server's id while developing — guild
   command deploys are instant, global ones take up to an hour.

4. **Warm the species cache** (do this before going live, so `/openpack`
   never blocks on a live network call)
   ```
   node scripts/seed.js 1 151      # Gen 1 only, ~151 species
   ```
   Widen the range any time to add more generations (e.g.
   `node scripts/seed.js 152 251` for Gen 2), then re-run to refresh.

5. **Deploy slash commands**
   ```
   npm run deploy
   ```

6. **Run the bot**
   ```
   npm start
   ```

## Architecture

```
src/
  index.js              Bot entry point — loads commands, routes interactions
  config.js             All tunable numbers (pack cost, points, shiny odds...)
  database/
    schema.sql           SQLite schema (species cache, users, cards, trades, battles)
    db.js                 Connection + small query helpers
  data/
    pokeapi.js            Fetches + caches species from PokeAPI
    rarity.js              Rarity tiers and pack drop-rate weights
  game/
    ivEv.js                IV rolling, stat formula, EV gain-on-win logic
    packOpening.js          Pack pull logic (rarity roll → species → IVs → shiny)
    typeChart.js             Type effectiveness multipliers
    moves.js                  Generic per-type moveset generator (no copyrighted move data)
    battleEngine.js            Turn resolution, damage formula, simple AI
    battleSession.js            In-memory active battle state
    pendingChallenges.js         In-memory pending PvP challenge invites
    deckHelpers.js                Fetch a user's deck lead cleanly
  commands/               One file per slash command
  components/             Button interaction handlers (battle, trade)
  utils/                  Embed builders, HP bars, move buttons
scripts/seed.js          One-time/occasional species cache warmer
deploy-commands.js       Registers slash commands with Discord
```

## Design notes & extension points

- **IVs vs EVs**: IVs are rolled once per card at pull time and never
  change — that's what makes two pulls of the same species meaningfully
  different, same as two encounters of the same species in-game. EVs
  start at 0 and are earned by winning battles (capped 252/stat, 510
  total); the stat gained matches whichever stat the defeated species
  "yields" in the real games (pulled straight from PokeAPI's `effort`
  field).
- **Natures** aren't implemented yet but the schema already has
  everything else needed — add a `nature` column to `cards` and a
  multiplier table, then apply it in `computeStats()`.
- **Battles are single-card (lead vs lead)** for now, not full 6-card
  team battles with switching. The `in_deck_slot` column already
  supports up to `config.maxDeckSize` cards per deck if you want to
  extend `battleEngine.js` to a switch-based team format later.
- **Moves are generic**, derived from each species' type (`Fire Strike`,
  `Fire Blast`, etc.) rather than real move names — this keeps the whole
  battle system independent of copyrighted move data. Swap in a custom
  curated moveset table any time without touching the engine.
- **Sessions are in-memory** (`battleSession.js`, `pendingChallenges.js`)
  since battles are short-lived; only the final result is persisted to
  the `battles` table. If you scale to multiple bot processes, move
  these to Redis.
- **Rarity tiers** (`data/rarity.js`) are a placeholder dex-id-based
  split — swap in a hand-curated list once you know exactly which
  generations/species you're including, or add a real "set" concept
  (Base Set, Legendary Set, etc.) with its own drop table per pack type.
