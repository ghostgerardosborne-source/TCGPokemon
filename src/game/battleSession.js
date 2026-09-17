const { randomUUID } = require('node:crypto');

// Battles are short-lived (minutes), so keeping them in memory rather than
// the DB is fine — if the bot restarts mid-battle, players just start a
// new one. Only the final result gets persisted to the `battles` table.
const activeSessions = new Map();

function createSession({ fighterA, fighterB, isAi, channelId }) {
  const id = randomUUID();
  const session = { id, fighterA, fighterB, isAi, channelId, log: [], createdAt: Date.now() };
  activeSessions.set(id, session);
  return session;
}

function getSession(id) {
  return activeSessions.get(id);
}

function endSession(id) {
  activeSessions.delete(id);
}

module.exports = { createSession, getSession, endSession };
