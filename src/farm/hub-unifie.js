// HUB unifié (test) : statut FS25 + classement des exploitations + commerce dans UN message, édité en place.
// Ne touche pas au HUB actuel (hub2.js). Publié par /hub-unifie dans le salon où la commande est lancée.
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dataPath } = require('../core/paths');
const { panneau } = require('../core/embed-format');

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
  champs.push({ name: '👨‍🌾  Joueurs en ligne (' + d.players.length + ')', value: (d.players.map(n => '• ' + n).join('\n') || '_Personne_').slice(0, 1024) });
  return { title: '🟢  ' + NOM(), color: 0x23A559, fields: champs };
}

const exploitations = st => ({
  title: '🌾  EXPLOITATIONS · CLASSEMENT', color: 0x5865F2,
  description: ((st && require('./hub2').classement(st)) || '_Aucune exploitation._').slice(0, 3800) + '\n\n*Un niveau ne baisse jamais · niveaux 1 à 20*',
});

const commerce = () => ({
  title: '🤝  COMMERCE', color: 0xF0B232,
  description: ['📋  **Contrat** · propose tes services ou cherche un joueur', '📦  **Besoin** · recherche une matière première', '🏪  **Marché** · produits en vente sur le serveur', '🛒  **Boutique** · points de classement contre argent en jeu'].join('\n'),
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
  const vieux = mem.msgId ? await ch.messages.fetch(mem.msgId).catch(() => null) : null;
  if (vieux && !forcerSalon && mem.hash === hash) return;
  let msg = null;
  if (vieux && !forcerSalon) msg = await vieux.edit(p).catch(() => null);
  if (!msg) { await vieux?.delete().catch(() => {}); msg = await ch.send(p); }
  ecrire({ salonId, msgId: msg.id, hash });
}

function init(client) { setInterval(() => maj(client).catch(e => console.warn('⚠️ HUB unifié :', e.message)), 60_000); }

module.exports = { maj, init, payload };
