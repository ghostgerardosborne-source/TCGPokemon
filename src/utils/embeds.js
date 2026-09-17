const { EmbedBuilder } = require('discord.js');

const RARITY_COLOR = {
  common: 0x9aa0a6,
  uncommon: 0x2ecc71,
  rare: 0x3498db,
  legendary: 0xf1c40f,
};

function cardEmbed({ species, card, showIvEv = true }) {
  const name = card.nickname || capitalize(species.name);
  const sprite = card.is_shiny ? species.shiny_sprite_url : species.sprite_url;
  const embed = new EmbedBuilder()
    .setTitle(`${card.is_shiny ? '✨ ' : ''}${name}${card.is_shiny ? ' (Shiny)' : ''}`)
    .setColor(RARITY_COLOR[species.rarity] || 0x9aa0a6)
    .setDescription(`Lv. ${card.level} • ${[species.type1, species.type2].filter(Boolean).join(' / ')} • ${species.rarity}`)
    .setThumbnail(sprite || null)
    .addFields({ name: 'Card ID', value: `#${card.id}`, inline: true });

  if (showIvEv) {
    embed.addFields(
      {
        name: 'IVs (fixed)',
        value: `HP ${card.iv_hp} · Atk ${card.iv_atk} · Def ${card.iv_def} · SpA ${card.iv_spa} · SpD ${card.iv_spd} · Spe ${card.iv_spe}`,
      },
      {
        name: 'EVs (trainable)',
        value: `HP ${card.ev_hp} · Atk ${card.ev_atk} · Def ${card.ev_def} · SpA ${card.ev_spa} · SpD ${card.ev_spd} · Spe ${card.ev_spe}`,
      }
    );
  }
  return embed;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

module.exports = { cardEmbed, RARITY_COLOR, capitalize };
