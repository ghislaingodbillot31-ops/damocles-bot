// Salon « ressources » : produits de la carte par blocs de 10.
// 🟢 = le produit est dans son meilleur mois de vente (facteurs de prix du jeu, prix-mois.json) ; dessous, top 3 des ventes DU MOIS EN COURS.
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const { dataPath } = require('../core/paths');
const FR = require('./ressources-fr');
const PRIX_MOIS = require('./prix-mois.json'); // fillType -> 12 facteurs (période 1 = mars … 12 = février)

const FOOTER = 'MonCopainBot · Ressources';
const MEDALS = ['🥇', '🥈', '🥉'];
const MOIS = ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février'];
const PAR_BLOC = 10;
const STORE = dataPath('ressources-mois.json');

// Meilleur mois de vente atteint ? (un produit au prix constant toute l'année n'est jamais « vert »)
function estMeilleur(cle, period) {
  const f = PRIX_MOIS[cle];
  return !!f && Math.max(...f) > Math.min(...f) && f[period - 1] >= Math.max(...f);
}

// Exploitations classées par quantité vendue d'un produit (compteurs `sold` du mod).
function classement(status, fillType) {
  const nom = (id) => (status.farms.find((f) => f.id === id) || {}).name || `Ferme ${id}`;
  const total = new Map();
  for (const c of status.counters) if (c.kind === 'sold' && c.fillType === fillType && c.value > 0) total.set(c.farm, (total.get(c.farm) || 0) + c.value);
  return [...total].map(([id, litres]) => ({ nom: nom(id), litres })).sort((a, b) => b.litres - a.litres);
}

// Ventes du mois en cours = compteurs actuels − compteurs relevés au changement de mois du jeu.
// ponytail: au premier lancement (ou fichier perdu) le « mois » compte tout depuis la dernière remise à zéro.
function ventesDuMois(status) {
  const cle = `${status.year}-${status.period}`;
  const id = (c) => `${c.farm}|${c.fillType}`;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(STORE, 'utf-8')); } catch {}
  const sold = status.counters.filter((c) => c.kind === 'sold');
  if (saved.cle !== cle) {
    saved = { cle, base: saved.cle ? Object.fromEntries(sold.map((c) => [id(c), c.value])) : {} };
    try { fs.writeFileSync(STORE, JSON.stringify(saved)); } catch (e) { console.warn('[FS25] Ressources (mois) :', e.message); }
  }
  return { ...status, counters: sold.map((c) => ({ ...c, value: c.value >= (saved.base[id(c)] || 0) ? c.value - (saved.base[id(c)] || 0) : c.value })) };
}

// -> tableau de blocs de texte (10 produits chacun)
function blocs(rows, status, period) {
  const lignes = rows
    .filter((r) => FR[r.fillType]) // seulement la liste officielle
    .map((r) => ({ cle: r.fillType, nom: FR[r.fillType] }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((r) => {
      const top = status ? classement(status, r.cle).filter((v) => v.litres >= 0.5).slice(0, 3) : [];
      return { vert: estMeilleur(r.cle, period), txt: `${estMeilleur(r.cle, period) ? '🟢' : '⚪'} **${r.nom}**` +
        (top.length ? '\n' + top.map((v, i) => `${MEDALS[i]} ${v.nom} ${Math.round(v.litres).toLocaleString('fr-FR')} L`).join(' · ') : '') };
    });
  const out = [];
  for (let i = 0; i < lignes.length; i += PAR_BLOC) {
    const b = lignes.slice(i, i + PAR_BLOC);
    out.push({ texte: b.map((l) => l.txt).join('\n\n'), vert: b.some((l) => l.vert) });
  }
  return out;
}

// Crée / met à jour les messages du salon (un message par bloc de 10, édité seulement s'il a changé, sans notification).
async function publier(channel) {
  const bridge = require('./fs25-bridge');
  const { sections } = await bridge.lireDonneesCompletes();
  const status = bridge.getLastFs25Status() || await bridge.lireStatutUneFois();
  const parts = blocs(sections.prices || [], ventesDuMois(status), status.period);
  if (!parts.length) throw new Error('section prices vide dans full.xml');
  const mois = MOIS[status.period - 1];
  const embeds = parts.map((p, i) => new EmbedBuilder().setColor(p.vert ? 0x2ECC71 : 0x95A5A6)
    .setTitle(i === 0 ? `🌾 RESSOURCES · ${mois.toUpperCase()} (année ${status.year})` : null)
    .setDescription((i === 0 ? '🟢 = meilleur mois de vente · classement : ventes du mois en cours\n\n' : '') + p.texte)
    .setFooter({ text: `${FOOTER} · ${i + 1}/${parts.length}` }));
  const msgs = [...(await channel.messages.fetch({ limit: 100 })).values()]
    .filter((m) => m.author.id === channel.client.user.id && m.embeds[0]?.footer?.text?.startsWith(FOOTER))
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  for (let i = 0; i < embeds.length; i++) {
    const n = embeds[i].toJSON();
    const o = msgs[i]?.embeds[0];
    if (!msgs[i]) await channel.send({ embeds: [embeds[i]] });
    else if (o.description !== n.description || o.title !== (n.title || null) || o.color !== n.color || o.footer?.text !== n.footer.text) await msgs[i].edit({ embeds: [embeds[i]] });
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
  setInterval(run, 10 * 60_000);
}

module.exports = { publier, start, blocs, classement, estMeilleur, ventesDuMois };
