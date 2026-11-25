// HUB unifié (test) : statut FS25 + classement des exploitations + commerce dans UN message, édité en place.
// Ne touche pas au HUB actuel (hub2.js). Publié par /hub-unifie dans le salon où la commande est lancée.
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dataPath } = require('../core/paths');
const { panneau } = require('../core/embed-format');

const HUB_ACTUEL = require('../core/ids')('EXPLOITANTS_HUB_CHANNEL_ID', '1569517803747152033');
const FICHIER = dataPath('hub-unifie.json');
const MOIS = ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février'];
const SAISONS = { 1: '🌸 Printemps', 2: '☀️ Été', 3: '🍂 Automne', 4: '❄️ Hiver' };
const NOM = () => process.env.FS25_SERVER_NAME || 'SERVEUR FS25';
const eur = v => Math.round(v).toLocaleString('fr-FR').replace(/[  ]/g, ' ');

const lire = () => { try { return JSON.parse(fs.readFileSync(FICHIER, 'utf-8')); } catch { return {}; } };
const ecrire = d => fs.writeFileSync(FICHIER, JSON.stringify(d, null, 2));

function serveur(d) {
  if (!d) return { title: '⏳  ' + NOM(), color: 0x949BA4, description: '_Pas encore de données du serveur._' };
  const hhmm = String(d.hour).padStart(2, '0') + ':' + String(d.minute).padStart(2, '0');
  const temp = d.temperature !== null && d.temperature > -900 ? ' · ' + Math.round(d.temperature) + ' °C' : '';
  const champs = [
    d.map && { name: 'Carte', value: d.map, inline: true },
    { name: 'Heure', value: hhmm + ' · x' + Math.round(d.timeScale), inline: true },
    { name: 'Date', value: 'Jour ' + d.dayInPeriod + '/' + d.daysPerPeriod + ' · ' + MOIS[(d.period - 1 + 12) % 12] + ' · An ' + d.year, inline: true },
    { name: 'Saison', value: (SAISONS[d.season] || '—') + temp, inline: true },
  ].filter(Boolean);
  if (d.farms.length) {
    const w = Math.min(14, Math.max(5, ...d.farms.map(f => f.name.length)));
    const a = Math.max(6, ...d.farms.map(f => eur(f.money).length));
    const l = Math.max(4, ...d.farms.map(f => eur(f.loan).length));
    const tete = 'Ferme'.padEnd(w) + '  ' + 'Argent'.padStart(a) + '  ' + 'Prêt'.padStart(l);
    const lignes = d.farms.map(f => f.name.slice(0, w).padEnd(w) + '  ' + eur(f.money).padStart(a) + '  ' + (f.loan > 0 ? eur(f.loan) : '—').padStart(l));
    champs.push({ name: '💰  Finances', value: ['```', tete, '─'.repeat(tete.length), ...lignes, '```'].join('\n').slice(0, 1024) });
  }
  champs.push({ name: '👨‍🌾  Joueurs en ligne (' + d.players.length + ')', value: (d.players.join(' · ') || '_Personne_').slice(0, 1024) });
  return { title: '🟢  ' + NOM(), color: 0x23A559, fields: champs };
}

// Une ferme = nom en gras + stats en code, activités en petit dessous (comme la maquette)
const exploitations = st => {
  const h = require('./hub2');
  const lignes = st ? require('./niveaux').classement(st).map((x, k) =>
    (['🥇', '🥈', '🥉'][k] || '`' + (k + 1) + '.`') + ' **' + x.farm.name + '**  `niv. ' + x.f.niveau + ' · ' + x.f.score + ' succès`\n-# ' + (h.actsDe(x.farm.name).join(' · ') || 'Aucune activité choisie')) : [];
  return {
    title: '🌾  EXPLOITATIONS · CLASSEMENT', color: 0x5865F2,
    description: (lignes.join('\n') || '_Aucune exploitation._').slice(0, 3800) + '\n\n-# Un niveau ne baisse jamais · niveaux 1 à 20',
  };
};

const commerce = () => ({
  title: '🤝  COMMERCE', color: 0xF0B232,
  fields: [['📋  Contrat', 'Propose tes services ou cherche un joueur'], ['📦  Besoin', 'Recherche une matière première'], ['🏪  Marché', 'Produits en vente sur le serveur'], ['🛒  Boutique', 'Points de classement contre argent en jeu']]
    .map(([name, value]) => ({ name, value, inline: true })),
  footer: { text: 'MonCopainBot' },
});

const etiquette = t => new ButtonBuilder().setCustomId('hubu_' + t).setLabel(t.toUpperCase()).setStyle(ButtonStyle.Secondary).setDisabled(true);
const bouton = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function payload() {
  const st = require('./fs25-succes').getStatus();
  const d = require('./fs25-bridge').getLastFs25Status();
  const info = Object.fromEntries(require('./hub-info').get().boutons.map(b => [b.key, b]));
  const rangeeInfo = ['reglement', 'drive', 'motdepasse', 'mods'].filter(k => info[k]?.actif)
    .map(k => bouton('hubinfo_' + k, info[k].label, ButtonStyle.Secondary));
  const param = info.parametre?.actif ? [bouton('hubinfo_parametre', info.parametre.label, ButtonStyle.Secondary)] : [];
  return panneau({
    embeds: [serveur(d), exploitations(st), commerce()],
    components: [
      new ActionRowBuilder().addComponents(etiquette('Serveur'), ...rangeeInfo),
      new ActionRowBuilder().addComponents(etiquette('Exploitation'),
        bouton('hub_expl', '🌾 Mon exploitation', ButtonStyle.Success), bouton('nv_succes', '🏆 Succès', ButtonStyle.Primary),
        bouton('nv_act', '🛒 Activités', ButtonStyle.Primary), ...param),
      new ActionRowBuilder().addComponents(etiquette('Commerce'),
        bouton('hub_contrat', '📋 Contrat', ButtonStyle.Primary), bouton('hub_besoin', '📦 Besoin', ButtonStyle.Primary),
        bouton('hub_marche', '🏪 Marché', ButtonStyle.Success), bouton('hub_boutique', '🛒 Boutique', ButtonStyle.Secondary)),
    ],
  });
}

// Édite le message publié s'il a changé ; le recrée s'il a été supprimé.
async function maj(client, forcerSalon) {
  const mem = lire();
  const salonId = forcerSalon || mem.salonId;
  if (!salonId) return;
  const ch = await client.channels.fetch(salonId).catch(() => null);
  if (!ch) return;
  const p = payload();
  const hash = JSON.stringify(p);
  if (forcerSalon && forcerSalon === HUB_ACTUEL) { // remplace l'ancien HUB : tous les messages du bot dans ce salon sont retirés
    for (const m of (await ch.messages.fetch({ limit: 100 }).catch(() => new Map())).values()) if (m.author.id === client.user.id) await m.delete().catch(() => {});
    mem.msgId = null;
  }
  const vieux = mem.msgId ? await ch.messages.fetch(mem.msgId).catch(() => null) : null;
  if (vieux && !forcerSalon && mem.hash === hash) return;
  let msg = null;
  if (vieux && !forcerSalon) msg = await vieux.edit(p).catch(() => null);
  if (!msg) { await vieux?.delete().catch(() => {}); msg = await ch.send(p); }
  ecrire({ salonId, msgId: msg.id, hash });
}

function init(client) {
  // première fois : le HUB unifié prend la place de l'ancien dans son salon (ensuite il s'édite en place)
  if (!lire().salonId) setTimeout(() => maj(client, HUB_ACTUEL).catch(e => console.warn('⚠️ HUB unifié :', e.message)), 45_000);
  // au démarrage : retire tout autre message du bot resté dans le salon (ancien statut, ancien HUB), sauf le HUB unifié
  setTimeout(async () => {
    const mem = lire(); if (!mem.salonId || !mem.msgId) return;
    const ch = await client.channels.fetch(mem.salonId).catch(() => null);
    for (const m of (await ch?.messages.fetch({ limit: 100 }).catch(() => new Map()) || new Map()).values())
      if (m.author.id === client.user.id && m.id !== mem.msgId) await m.delete().catch(() => {});
  }, 90_000);
  setInterval(() => maj(client).catch(e => console.warn('⚠️ HUB unifié :', e.message)), 60_000); }

// vrai quand le HUB unifié a remplacé l'ancien dans son salon : hub2.maj() ne republie plus rien
const remplace = () => lire().salonId === HUB_ACTUEL;

module.exports = { maj, init, payload, remplace };
