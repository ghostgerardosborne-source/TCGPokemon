// We don't reproduce real move names/animations/flavor text — these are
// generic, original move labels generated from the card's type, so the
// battle system doesn't depend on copyrighted move data at all.
function movesetFor(species) {
  const type = species.type1;
  const moves = [
    { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 1 },
    { name: `${capitalize(type)} Strike`, type, category: 'physical', power: 65, accuracy: 0.95 },
    { name: `${capitalize(type)} Blast`, type, category: 'special', power: 65, accuracy: 0.9 },
    { name: 'Guard Up', type: 'normal', category: 'status', power: 0, accuracy: 1, effect: 'guard' },
  ];
  return moves;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

module.exports = { movesetFor };
