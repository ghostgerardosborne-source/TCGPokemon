const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const config = require('../config');

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema.sql on every boot — CREATE TABLE IF NOT EXISTS is idempotent,
// so this doubles as our migration mechanism for now.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ---- Users -----------------------------------------------------------
function ensureUser(discordId) {
  const existing = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
  if (existing) return existing;
  db.prepare('INSERT INTO users (discord_id, created_at) VALUES (?, ?)').run(discordId, Date.now());
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
}

function getUser(discordId) {
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
}

function addPoints(discordId, amount) {
  ensureUser(discordId);
  db.prepare('UPDATE users SET points = points + ? WHERE discord_id = ?').run(amount, discordId);
  return getUser(discordId);
}

function spendPoints(discordId, amount) {
  const user = ensureUser(discordId);
  if (user.points < amount) return false;
  db.prepare('UPDATE users SET points = points - ? WHERE discord_id = ?').run(amount, discordId);
  return true;
}

module.exports = { db, ensureUser, getUser, addPoints, spendPoints };
