// Données complètes du mod (full.xml) : lecture et rendu génériques.
// Toute nouvelle section ajoutée dans le mod apparaît ici sans modifier le bot.
const { EmbedBuilder } = require('discord.js');

const cache = { at: 0, sections: null, exportedAt: '' };

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) {
    out[m[1]] = m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  return out;
}

// -> { vehicles: [{name, farm, ...}], fields: [...], ... }
function parseFull(xml) {
  const sections = {};
  for (const m of xml.matchAll(/<section\b([^>]*?)(?:\/>|>([\s\S]*?)<\/section>)/g)) {
    const name = attrs(m[1]).name;
    if (name) sections[name] = [...(m[2] || '').matchAll(/<e\b[^>]*?\/?>/g)].map((e) => attrs(e[0]));
  }
  return { sections, exportedAt: (xml.match(/<full\b[^>]*exportedAt="([^"]*)"/) || [])[1] || '' };
}

// Lecture mise en cache 30 s ; `read` = fonction (since) -> {data} du pont FTP/SFTP.
async function loadFull(read, fullPath) {
  if (cache.sections && Date.now() - cache.at < 30000) return cache;
  const { data } = await read(fullPath, null);
  Object.assign(cache, parseFull(data), { at: Date.now() });
  return cache;
}

const KEEP_HIDDEN = new Set(['x', 'z', 'farm']); // colonnes techniques masquées
const fmt = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v).toLocaleString('fr-FR') : v);

// Rendu générique : une ligne par entrée, "valeur · clé=valeur ..." (limite 4096 caractères d'embed)
function sectionEmbed(name, rows, exportedAt, farmFilter) {
  if (farmFilter) rows = rows.filter((r) => (r.farmName || r.name || '').toLowerCase().includes(farmFilter.toLowerCase()));
  const lines = [];
  for (const r of rows) {
    const title = r.name || r.title || r.fillType || r.type || r.id || '—';
    const rest = Object.entries(r)
      .filter(([k, v]) => !KEEP_HIDDEN.has(k) && v !== title && !['name', 'title', 'fillType', 'type'].includes(k))
      .map(([k, v]) => `${k}: ${fmt(v)}`).join(' · ');
    lines.push(`**${title}**${rest ? `  ${rest}` : ''}`);
  }
  let desc = '';
  let shown = 0;
  for (const l of lines) {
    if (desc.length + l.length + 1 > 3900) break;
    desc += (desc ? '\n' : '') + l; shown++;
  }
  if (shown < lines.length) desc += `\n… et ${lines.length - shown} autres`;
  return new EmbedBuilder().setColor(0x6aa84f).setTitle(`📊 ${name} (${rows.length})`)
    .setDescription(desc || '_Aucune donnée_').setFooter({ text: `Relevé du ${exportedAt}` });
}

module.exports = { parseFull, loadFull, sectionEmbed };
