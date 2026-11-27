// Salon « ressources » : liste des produits de la carte.
// Texte vert = le produit est dans son meilleur mois de vente (facteurs de prix du jeu, prix-mois.json) ; dessous, top 3 des ventes DU MOIS EN COURS.
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const { dataPath } = require('../core/paths');
const FR = require('./ressources-fr');
const PRIX_MOIS = require('./prix-mois.json'); // fillType -> 12 facteurs (période 1 = mars … 12 = février)

const FOOTER = 'MonCopainBot · Ressources';
const MEDALS = ['🥇', '🥈', '🥉'];
const MOIS = ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février'];
const BLOCS = 3; // nombre de grands messages
const LARGEUR = 50; // caractères : largeur commune des blocs (à ajuster si les blocs paraissent trop larges ou trop étroits)
const STORE = dataPath('ressources-mois.json');

// Meilleur mois de vente atteint ? (un produit au prix constant toute l'année n'est jamais « vert »)
function estMeilleur(cle, period) {
  const f = PRIX_MOIS[cle];
  return !!f && Math.max(...f) > Math.min(...f) && f[period - 1] >= 0.95 * Math.max(...f); // ≥ 95 % du meilleur prix de l'année : « vert »
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

const initiale = (nom) => nom.normalize('NFD')[0].toUpperCase(); // « Épinards » -> E

// -> tableau de messages { texte, vert } découpés par taille
function blocs(rows, status, period) {
  const lignes = rows
    .filter((r) => FR[r.fillType]) // seulement la liste officielle
    .map((r) => ({ cle: r.fillType, nom: FR[r.fillType] }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((r) => {
      const top = status ? classement(status, r.cle).filter((v) => v.litres >= 0.5).slice(0, 3) : [];
      const vert = estMeilleur(r.cle, period);
      return { vert, nom: r.nom, txt: (vert ? '\u001b[1;32m' : '\u001b[1;37m') + r.nom + '\u001b[0m' + // texte coloré : bloc ```ansi (couleurs visibles sur ordinateur)
        (top.length ? '\n' + top.map((v, i) => `${MEDALS[i]} \u001b[1;34m${v.nom}\u001b[0m ${Math.round(v.litres).toLocaleString('fr-FR')} L`).join(' · ') : '') };
    });
  // BLOCS groupes consécutifs (ordre alphabétique) de longueur de texte à peu près égale
  const total = lignes.reduce((n, l) => n + l.txt.length + 1, 0);
  const groupes = [[]];
  let taille = 0;
  for (const l of lignes) {
    if (groupes.length < BLOCS && taille >= (total / BLOCS) * groupes.length) groupes.push([]);
    groupes[groupes.length - 1].push(l);
    taille += l.txt.length + 1;
  }
  return groupes.filter((ls) => ls.length).map((ls) => {
    const lettre = `${initiale(ls[0].nom)} → ${initiale(ls[ls.length - 1].nom)}`;
    // 1re ligne complétée par des espaces : tous les blocs ont ainsi la même largeur (le bloc de code s'ajuste à sa ligne la plus longue)
    const txts = ls.map((l) => l.txt);
    txts[0] = txts[0].replace(/^([^\n]*)/, (m) => m + ' '.repeat(Math.max(0, LARGEUR - (ls[0].nom.length))));
    return { texte: '```ansi\n' + txts.join('\n') + '\n```', vert: ls.some((l) => l.vert), lettre };
  });
}

// Crée / met à jour les messages du salon (édité seulement s'il a changé, sans notification).
async function publier(channel) {
  const bridge = require('./fs25-bridge');
  const { sections } = await bridge.lireDonneesCompletes();
  const status = bridge.getLastFs25Status() || await bridge.lireStatutUneFois();
  const parts = blocs(sections.prices || [], ventesDuMois(status), status.period);
  if (!parts.length) throw new Error('section prices vide dans full.xml');
  const mois = MOIS[status.period - 1];
  const embeds = parts.map((p, i) => new EmbedBuilder().setColor(p.vert ? 0x2ECC71 : 0x95A5A6)
    .setTitle(p.lettre)
    .setDescription(p.texte)
    // pied de page identique et long sur chaque bloc : il fixe la même largeur à tous les embeds
    .setFooter({ text: `${FOOTER} · ${mois} (année ${status.year}) · Vert = prix ≥ 95 % du maximum annuel · Top 3 = ventes du mois en cours` }));
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
