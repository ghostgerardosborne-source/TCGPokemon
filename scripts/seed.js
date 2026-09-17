// Warms the local species cache so /openpack and /battle never block on a
// live PokeAPI call. Run once before launch, and again whenever you widen
// the dex range (e.g. add Gen 2).
//
// Usage: node scripts/seed.js [startId] [endId]
// Default: Gen 1 only (1-151).

const { warmCache } = require('../src/data/pokeapi');

const start = parseInt(process.argv[2] || '1', 10);
const end = parseInt(process.argv[3] || '151', 10);

(async () => {
  console.log(`Caching species #${start}-${end} from PokeAPI...`);
  await warmCache(start, end, (id, total) => {
    process.stdout.write(`\r  #${id}/${total}`);
  });
  console.log('\nDone. Species cache is ready.');
})();
