// Salon « ressources » : liste globale des produits de la carte (section `prices` de full.xml) avec leur prix actuel.
const { EmbedBuilder } = require('discord.js');

const FOOTER = 'MonCopainBot · Ressources';
const euro = (v) => `${Math.round(Number(v)).toLocaleString('fr-FR')} €`;

// -> tableau de blocs de texte ≤ 3800 caractères (un embed chacun)
function blocs(rows) {
  const lignes = rows
    .map((r) => ({ nom: r.title || r.fillType, prix: Number(r.pricePer1000) }))
    .filter((r) => r.prix > 0)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((r) => `**${r.nom}** · ${euro(r.prix)} / 1000 L`);
  const out = [];
  let cur = '';
  for (const l of lignes) {
    if (cur.length + l.length + 1 > 3800) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + l;
  }
  if (cur) out.push(cur);
  return out;
}

// Crée / met à jour les messages du salon (édition en place, sans notification).
async function publier(channel) {
  const { sections, exportedAt } = await require('./fs25-bridge').lireDonneesCompletes();
  const parts = blocs(sections.prices || []);
  if (!parts.length) throw new Error('section prices vide dans full.xml');
  const embeds = parts.map((d, i) => new EmbedBuilder().setColor(0x6aa84f)
    .setTitle(i === 0 ? `🌾 RESSOURCES DE LA CARTE (${(sections.prices || []).length})` : null)
    .setDescription(d)
    .setFooter({ text: `${FOOTER} · ${i + 1}/${parts.length}${exportedAt ? ` · relevé du ${exportedAt}` : ''}` }));
  const msgs = [...(await channel.messages.fetch({ limit: 50 })).values()]
    .filter((m) => m.author.id === channel.client.user.id && m.embeds[0]?.footer?.text?.startsWith(FOOTER))
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  for (let i = 0; i < embeds.length; i++) {
    if (msgs[i]) await msgs[i].edit({ embeds: [embeds[i]] }); else await channel.send({ embeds: [embeds[i]] });
  }
  for (const m of msgs.slice(embeds.length)) await m.delete().catch(() => {});
}

function start(client) {
  const run = async () => {
    try { await publier(await client.channels.fetch(process.env.FS25_RESSOURCES_CHANNEL_ID)); }
    catch (e) { console.warn('[FS25] Ressources :', e.message); }
  };
  if (!process.env.FS25_RESSOURCES_CHANNEL_ID) return;
  setTimeout(run, 45_000);
  setInterval(run, 30 * 60_000);
}

module.exports = { publier, start, blocs };
