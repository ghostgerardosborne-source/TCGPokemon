const { effectiveness } = require('./typeChart');
const { computeStats } = require('./ivEv');
const { movesetFor } = require('./moves');

// Builds a "fighter" — the live battle state for one card — from its DB
// row + cached species row. side is 'A' or 'B', userId is null for an AI
// opponent.
function makeFighter({ side, userId, card, species }) {
  const stats = computeStats(species, card);
  return {
    side,
    userId,
    card,
    species,
    stats,
    currentHp: stats.hp,
    maxHp: stats.hp,
    moveset: movesetFor(species),
    guarding: false,
    chosenMoveIndex: null,
  };
}

function rollDamage(attacker, defender, move) {
  if (move.category === 'status') return { damage: 0, effectivenessMult: 1, missed: false };
  if (Math.random() > move.accuracy) return { damage: 0, effectivenessMult: 1, missed: true };

  const atkStat = move.category === 'physical' ? attacker.stats.atk : attacker.stats.spa;
  const defStat = move.category === 'physical' ? defender.stats.def : defender.stats.spd;
  const mult = effectiveness(move.type, defender.species.type1, defender.species.type2);
  const stab = move.type === attacker.species.type1 || move.type === attacker.species.type2 ? 1.5 : 1;
  const variance = 0.85 + Math.random() * 0.15; // 85%-100% roll, like the real games

  let damage = Math.floor(
    ((((2 * attacker.card.level) / 5 + 2) * move.power * (atkStat / Math.max(1, defStat))) / 50 + 2) *
      mult * stab * variance
  );
  if (defender.guarding) damage = Math.floor(damage * 0.5);
  return { damage: Math.max(move.power > 0 ? 1 : 0, damage), effectivenessMult: mult, missed: false };
}

// Resolves one full turn given both sides' chosen move indices. Faster
// fighter (by spe stat, ties broken randomly) acts first; if it KOs the
// opponent the second action is skipped. Mutates currentHp/guarding in
// place and returns a structured log entry for rendering.
function resolveTurn(fighterA, fighterB) {
  const moveA = fighterA.moveset[fighterA.chosenMoveIndex];
  const moveB = fighterB.moveset[fighterB.chosenMoveIndex];
  fighterA.guarding = moveA.effect === 'guard';
  fighterB.guarding = moveB.effect === 'guard';

  const order =
    fighterA.stats.spe === fighterB.stats.spe
      ? (Math.random() < 0.5 ? [fighterA, fighterB] : [fighterB, fighterA])
      : fighterA.stats.spe > fighterB.stats.spe
      ? [fighterA, fighterB]
      : [fighterB, fighterA];

  const log = [];
  for (const [attacker, defender] of [
    [order[0], order[1]],
    [order[1], order[0]],
  ]) {
    if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue;
    const move = attacker === fighterA ? moveA : moveB;
    if (move.effect === 'guard') {
      log.push({ actor: attacker.side, move: move.name, guard: true });
      continue;
    }
    const result = rollDamage(attacker, defender, move);
    if (!result.missed) defender.currentHp = Math.max(0, defender.currentHp - result.damage);
    log.push({
      actor: attacker.side,
      move: move.name,
      damage: result.damage,
      missed: result.missed,
      effectivenessMult: result.effectivenessMult,
      defenderHpRemaining: defender.currentHp,
    });
  }

  fighterA.chosenMoveIndex = null;
  fighterB.chosenMoveIndex = null;

  const winner = fighterA.currentHp <= 0 ? 'B' : fighterB.currentHp <= 0 ? 'A' : null;
  return { log, winner };
}

// Very small AI: prefers a damaging same-type move over Tackle, guards
// occasionally when low on HP. Good enough for a practice/solo opponent.
function chooseAiMove(fighter) {
  const lowHp = fighter.currentHp / fighter.maxHp < 0.3;
  if (lowHp && Math.random() < 0.4) {
    return fighter.moveset.findIndex((m) => m.effect === 'guard');
  }
  const damaging = fighter.moveset
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.category !== 'status');
  const best = damaging.reduce((a, b) => (b.m.power > a.m.power ? b : a));
  return best.i;
}

module.exports = { makeFighter, resolveTurn, chooseAiMove };
