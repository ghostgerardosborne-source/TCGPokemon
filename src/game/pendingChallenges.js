const { randomUUID } = require('node:crypto');

const pending = new Map();

function createChallenge({ challengerId, opponentId, channelId }) {
  const id = randomUUID();
  pending.set(id, { id, challengerId, opponentId, channelId, createdAt: Date.now() });
  return id;
}

function getChallenge(id) {
  return pending.get(id);
}

function removeChallenge(id) {
  pending.delete(id);
}

module.exports = { createChallenge, getChallenge, removeChallenge };
