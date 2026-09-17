require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,
  databasePath: process.env.DATABASE_PATH || './data/tcg.sqlite',
  pointsPerWin: parseInt(process.env.POINTS_PER_WIN || '50', 10),
  pointsPerLoss: parseInt(process.env.POINTS_PER_LOSS || '10', 10),
  packCost: parseInt(process.env.PACK_COST || '100', 10),
  shinyOdds: parseInt(process.env.SHINY_ODDS || '512', 10),
  cardsPerPack: 5,
  maxDeckSize: 6,
  maxLevel: 100,
  maxTotalEv: 510,
  maxStatEv: 252,
  maxIv: 31,
};
