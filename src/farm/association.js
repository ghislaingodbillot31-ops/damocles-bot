const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder,
} = require('discord.js');
const ids = require('../core/ids');
const { panneau } = require('../core/embed-format');
const { dataPath } = require('../core/paths');

// HUB de l'association [A] Le mechet (sylviculture) : présentation + adhésion.
// Adhésion = 30 000 € versés en jeu à la ferme de l'association → le staff valide dans un ticket → licence d'un an.
// Le salon contient : le panneau, puis le journal des membres licenciés (mis à jour à chaque adhésion / expiration).
const CHANNEL_ID = ids('ASSO_CHANNEL_ID', '1571180916863279285');
const STORE_PATH = dataPath('association.json');
const NOM        = '[A] Le mechet';
const PRIX       = 30000;
const DUREE      = 365 * 24 * 3600_000; // licence d'un an (temps réel)
const RENOUV     = 30 * 24 * 3600_000;  // renouvellement possible 30 jours avant l'échéance
const LOGS_ID    = '1567011774912532671'; // salon de logs habituel

// { panelMsgId, journalMsgId, membres: { userId: { pseudo, fin } }, demandes: { userId: { pseudo, ticketId, msgId } } }
let store = { panelMsgId: null, journalMsgId: null, membres: {}, demandes: {} };
const load = () => { try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {} };
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const ts = (ms, f) => '<t:' + Math.floor(ms / 1000) + ':' + f + '>';
const euros = n => n.toLocaleString('fr-FR') + ' €';
const estStaff = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator) || require('../moderation/tickets').estSupport(i.member);
const actifs = () => Object.entries(store.membres).filter(([, m]) => m.fin > Date.now()).sort((a, b) => a[1].fin - b[1].fin);
const rep = (i, content) => i.reply({ content, flags: 64, allowedMentions: { parse: [] } });

// ── Messages ──────────────────────────────────────────────────────────────────
function panelPayload() {
  return panneau({
    embeds: [{
      title: '🌲  ' + NOM.toUpperCase() + '  ·  ASSOCIATION DE SYLVICULTURE',
      description: [
        '## 🪓 L\'association',
        '**' + NOM + '** est une exploitation commune dédiée **uniquement au travail en forêt** :',
        '> • Abattage et façonnage des arbres',
        '> • Débardage et transport du bois',
        '> • Vente du bois',
        '> • Replantation des parcelles',
        '',
        'Le matériel est acheté avec l\'argent de l\'association et mis à disposition de tous les membres.',
        '',
        '## 🪪 Adhésion',
        'Tout le monde peut rejoindre l\'association.',
        '> • Droit d\'entrée : **' + euros(PRIX) + '**',
        '> • Tu obtiens une **licence valable 1 an**',
        '> • La licence te permet d\'**utiliser les machines** de l\'association et de **faire de la sylviculture**',
        '> • **Investissement** : tu peux injecter de l\'argent dans l\'association (virement depuis ta ferme) : ça te donne des **parts** pour obtenir des crédits plus facilement',
        '',
        '## 📋 Comment rejoindre',
        '**1.** Clique sur **Rejoindre l\'association** : un ticket s\'ouvre avec le staff.',
        '**2.** En jeu, verse **' + euros(PRIX) + '** à la ferme **' + NOM + '** (menu Finances → transférer de l\'argent).',
        '**3.** Le staff vérifie le versement : tu passes **LICENCIÉ** et tu as le droit de travailler pour l\'association.',
        '',
        'À l\'échéance, refais la même démarche pour renouveler ta licence (possible 30 jours avant la fin).',
        '',
        '## 🐷 Cagnotte et crédit',
        'Les licenciés ne sont pas payés : leur travail remplit une **cagnotte**.',
        '> • L\'argent gagné permet de **demander des crédits**, en fonction de ton **investissement**',
        '> • Plus un joueur s\'investit, plus le **montant débloqué** peut être élevé',
        '> • Le crédit est à **rembourser sous 1 an maximum**',
        '> • Chaque **25 décembre**, un pourcentage (**5 %**) est redistribué aux exploitations ayant travaillé pour l\'association',
      ].join('\n'),
      color: 0x2E7D32,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_rejoindre').setLabel('🪓 Rejoindre l\'association').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_licence').setLabel('🪪 Ma licence').setStyle(ButtonStyle.Secondary),
    )],
  });
}

const demandeEmbed = (uid, d, statut, color = 0xF1C40F, objet = 'Droit d\'entrée : **' + euros(PRIX) + '** à verser à la ferme **' + NOM + '**') => ({
  title: '🌲 Adhésion · ' + NOM,
  description: [
    'Joueur : <@' + uid + '> (`' + uid + '`)',
    'Pseudo en jeu : **' + d.pseudo + '**',
    objet,
    '',
    statut,
  ].join('\n'),
  color,
  timestamp: new Date().toISOString(),
});

// Log dans le salon de logs, sur UNE ligne comme les autres logs : `▶` 📝 **Titre** · <@joueur> (`pseudo`) · détails · date
async function log(client, title, uid, pseudo, extra, color) {
  const ch = await client.channels.fetch(LOGS_ID).catch(() => null);
  const [, emoji, texte] = title.match(/^(\S+)\s+([\s\S]*)$/) || [, '', title];
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const ligne = ['`▶` ' + (emoji ? emoji + ' ' : '') + '**' + texte + '**' + (uid !== '0' ? ' · <@' + uid + '> (`' + pseudo + '`)' : ''),
    extra && String(extra).replace(/\s*\n+\s*/g, ' · '), now].filter(Boolean).join(' · ');
  await ch?.send({ embeds: [{ description: ligne.slice(0, 4000), color, footer: { text: 'MonCopainBot · Log' }, timestamp: new Date().toISOString() }],
    allowedMentions: { parse: [] } }).catch(err => console.error('⚠️ Log association :', err.message));
}

// Licences arrivées à échéance : loggées une seule fois, puis retirées du journal
async function expirer(client) {
  for (const [uid, m] of Object.entries(store.membres)) {
    if (m.fin > Date.now() || m.expireLog) continue;
    m.expireLog = true;
    await log(client, '⌛ Licence expirée · ' + NOM, uid, m.pseudo, 'Fin de licence : ' + ts(m.fin, 'D') + ' · plus le droit de travailler pour l\'association.', 0x95A5A6);
  }
  save();
  await majSalaires(client);
}

async function handleLicence(interaction) {
  const m = store.membres[interaction.user.id];
  if (!m || m.fin <= Date.now()) return rep(interaction, '🪪 Tu n\'as pas de licence active' + (m ? ' (expirée le ' + ts(m.fin, 'D') + ')' : '') + '. Clique sur **Rejoindre l\'association**.');
  await rep(interaction, '🪪 Licence **' + NOM + '** active jusqu\'au ' + ts(m.fin, 'D') + ' (' + ts(m.fin, 'R') + ').');
}

async function handleRejoindre(interaction) {
  const uid = interaction.user.id;
  const m = store.membres[uid];
  if (m && m.fin - Date.now() > RENOUV) return rep(interaction, '🪪 Tu as déjà une licence active jusqu\'au ' + ts(m.fin, 'D') + '.');
  const d = store.demandes[uid];
  if (d && await interaction.client.channels.fetch(d.ticketId).catch(() => null)) return rep(interaction, '⏳ Ta demande est déjà en cours : <#' + d.ticketId + '>');
  await interaction.showModal(new ModalBuilder().setCustomId('asso_modal').setTitle('Rejoindre ' + NOM).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pseudo').setLabel('Ton pseudo en jeu (FS25)')
      .setStyle(TextInputStyle.Short).setMaxLength(40).setRequired(true).setValue(m?.pseudo || ''))));
}

async function handleModal(interaction) {
  const uid = interaction.user.id;
  const d = { pseudo: interaction.fields.getTextInputValue('pseudo').trim().replace(/`/g, '') };
  let ticket;
  try {
    ticket = await require('../moderation/tickets').ouvrirSalon(interaction.guild, interaction.member, {
      prefix: 'asso', objet: 'Adhésion ' + NOM,
      welcome: 'Verse **' + euros(PRIX) + '** en jeu à la ferme **' + NOM + '**, puis le staff validera ta licence ici.',
    });
  } catch (err) {
    console.error('⚠️ Association · ticket :', err.message);
    return rep(interaction, '⚠️ Impossible d\'ouvrir le ticket. Préviens un administrateur.');
  }
  const msg = await ticket.send({
    ...panneau({ embeds: [demandeEmbed(uid, d, '⏳ En attente du versement et de la validation du staff.')] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_ok_' + uid).setLabel('✅ Versement reçu · activer la licence').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_no_' + uid).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )],
  }).catch(() => null);
  store.demandes[uid] = { ...d, ticketId: ticket.id, msgId: msg?.id || null };
  save();
  await log(interaction.client, '📝 Demande d\'adhésion · ' + NOM, uid, d.pseudo, 'Versement attendu : **' + euros(PRIX) + '** · ticket <#' + ticket.id + '>', 0xF1C40F);
  await rep(interaction, '✅ Demande envoyée : <#' + ticket.id + '>\nVerse **' + euros(PRIX) + '** en jeu à la ferme **' + NOM + '**.');
}

async function handleDecision(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  const ok = interaction.customId.startsWith('asso_ok_');
  const uid = interaction.customId.slice(8);
  const d = store.demandes[uid];
  if (!d) return rep(interaction, 'ℹ️ Cette demande a déjà été traitée.');
  delete store.demandes[uid];
  let statut, color;
  if (ok) {
    const fin = Math.max(Date.now(), store.membres[uid]?.fin || 0) + DUREE; // renouvellement : s'ajoute à la licence en cours
    store.membres[uid] = { pseudo: d.pseudo, fin }; // statut LICENCIÉ : droit de travailler pour l'association
    statut = '✅ Licence activée par <@' + interaction.user.id + '> jusqu\'au ' + ts(fin, 'D') + '.';
    color = 0x2ECC71;
  } else {
    statut = '❌ Demande refusée par <@' + interaction.user.id + '>.';
    color = 0xE74C3C;
  }
  save();
  await log(interaction.client, ok ? '✅ Versement reçu · LICENCIÉ · ' + NOM : '❌ Adhésion refusée · ' + NOM, uid, d.pseudo,
    ok ? 'Versement : **' + euros(PRIX) + '** · licence jusqu\'au ' + ts(store.membres[uid].fin, 'D') + ' · validé par <@' + interaction.user.id + '>'
       : 'Refusé par <@' + interaction.user.id + '>', ok ? 0x2ECC71 : 0xE74C3C);
  await interaction.update({ ...panneau({ embeds: [demandeEmbed(uid, d, statut, color)] }), components: [], allowedMentions: { parse: [] } });
  if (ok) await majSalaires(interaction.client);
}

async function handle(interaction) {
  const id = interaction.customId;
  if (id === 'asso_modal')      return handleModal(interaction);
  if (id === 'asso_rejoindre')  return handleRejoindre(interaction);
  if (id === 'asso_licence')    return handleLicence(interaction);
  if (id === 'asso_paie')       return handlePaie(interaction);
  if (id === 'asso_admin')      return handleAdmin(interaction);
  if (id === 'asso_elec_lancer')   return handleLancer(interaction);
  if (id === 'asso_elec_candidat') return handleCandidat(interaction);
  if (id === 'asso_elec_vote')     return handleVoteBouton(interaction);
  if (id === 'asso_elec_choix')    return handleVoteChoix(interaction);
  if (id === 'asso_credit' || id === 'asso_remb') return handleOpButton(interaction);
  if (/^asso_opmodal_(credit|remb)$/.test(id))    return handleOpModal(interaction);
  if (/^asso_op(ok|no)_\d+$/.test(id))            return handleOpDecision(interaction);
  if (/^asso_(ok|no)_\d+$/.test(id)) return handleDecision(interaction);
}

// ── Démarrage : panneau puis journal, dans cet ordre ──────────────────────────
// ── Salaires : temps de travail (mod DiscordBridge) × revenus de l'association sur la période ──
// Compteurs du mod, cumulés depuis son installation : la période = valeur actuelle − valeur à la dernière paie.
// Seuls les membres LICENCIÉS qui ont travaillé (véhicule de l'asso moteur allumé, ou tronçonneuse) sont comptés.
const PART      = 0.5; // part des revenus de la période versée dans les cagnottes des travailleurs
const HORS_REVENU = /^(TRANSFER|SHOP_|FIELD_SELL|LOAN)/; // dons, droits d'entrée, ventes de matériel/terrain : pas des revenus du travail

function releve(status) {
  const farm = status?.farms?.find(f => f.name === NOM);
  if (!farm) return null;
  const work = {}; let revenu = 0;
  for (const c of status.counters) {
    if (c.farm !== farm.id) continue;
    if (c.kind === 'work_vehicle' || c.kind === 'work_chainsaw') work[c.fillType.toLowerCase()] = (work[c.fillType.toLowerCase()] || 0) + c.value;
    if (c.kind === 'money_in' && !HORS_REVENU.test(c.fillType)) revenu += c.value;
  }
  return { work, revenu, caisse: farm.money };
}

let dernierReleve = null;
function calcul() {
  const r = dernierReleve;
  if (!r) return null;
  if (!store.paie) { store.paie = { at: Date.now(), ...r }; save(); } // 1re fois : la période commence maintenant
  const base = store.paie;
  const revenu = Math.max(0, r.revenu - base.revenu);
  const lignes = actifs().map(([u, m]) => {
    const k = m.pseudo.toLowerCase();
    return { u, pseudo: m.pseudo, s: (r.work[k] || 0) - (base.work[k] || 0) };
  }).filter(l => l.s >= 60).sort((a, b) => b.s - a.s); // moins d'une minute = pas de travail
  const total = lignes.reduce((a, l) => a + l.s, 0);
  for (const l of lignes) { l.part = l.s / total; l.gain = Math.round(revenu * PART * l.part); }
  return { revenu, lignes };
}

const duree = s => Math.floor(s / 3600) + ' h ' + String(Math.floor(s / 60) % 60).padStart(2, '0');
const MEDAILLES = ['🥇', '🥈', '🥉'];

// Cagnottes et crédits : cagnottes[uid] = € disponibles pour un crédit, credits[uid] = € restant à rembourser,
// ops[uid] = demande en cours { type: 'credit' | 'remb', montant, ticketId } (une seule à la fois).
const cagnotte = uid => Math.round((store.cagnottes ||= {})[uid] || 0);
const dette    = uid => Math.round((store.credits ||= {})[uid] || 0);

function salairesPayload() {
  const caisse = dernierReleve ? euros(Math.round(dernierReleve.caisse || 0)) : '_en attente des données du serveur FS25_';
  const debiteurs = Object.entries(store.credits || {}).filter(([u]) => dette(u) > 0).sort((a, b) => dette(b[0]) - dette(a[0]));
  const description = [
    ...presidentLignes(),
    '',
    ...investissement(),
    '',
    '## 🏦 Caisse de l\'association',
    'Solde : **' + caisse + '**',
    '',
    '## 💳 Crédits en cours',
    ...(debiteurs.length ? debiteurs.slice(0, 20).map(([u]) => '• <@' + u + '> · `' + (store.membres[u]?.pseudo || '?') + '` · reste à payer **' + euros(dette(u)) + '**') : ['_Aucun crédit en cours._']),
  ].join('\n');
  return {
    ...panneau({ embeds: [{ title: '🐷  LICENCE ET FINANCE', description, color: 0xF1C40F, footer: { text: 'MonCopainBot · mis à jour toutes les 5 min' }, timestamp: new Date().toISOString() }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_credit').setLabel('💳 Demander un crédit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_remb').setLabel('💶 Rembourser').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('asso_paie').setLabel('🐷 Clôturer la période (staff)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('asso_admin').setLabel('⚙️ Administratif').setStyle(ButtonStyle.Secondary),
      ...boutonsElection())],
    allowedMentions: { parse: [] },
  };
}

async function majSalaires(client) {
  dernierReleve = releve(require('./fs25-bridge').getLastFs25Status()) || dernierReleve;
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  const m = ch && store.salairesMsgId && await ch.messages.fetch(store.salairesMsgId).catch(() => null);
  if (m) await m.edit(salairesPayload()).catch(() => {});
}

// Staff : fige la période, ajoute la part de chaque travailleur à sa cagnotte, puis repart de zéro
async function handlePaie(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  const c = calcul();
  if (!c) return rep(interaction, '⚠️ Pas de données du serveur FS25 pour le moment.');
  for (const l of c.lignes) store.cagnottes[l.u] = cagnotte(l.u) + l.gain;
  await log(interaction.client, '🐷 Période clôturée · ' + NOM, '0', '',
    'par <@' + interaction.user.id + '> · revenus **' + euros(Math.round(c.revenu)) + '** · ajouté aux cagnottes (' + (PART * 100) + ' %) : **' + euros(c.lignes.reduce((a, l) => a + l.gain, 0)) + '**'
    + (c.lignes.length ? ' · ' + c.lignes.map(l => '<@' + l.u + '> ' + duree(l.s) + ' +' + euros(l.gain)).join(', ') : ' · personne n\'a travaillé'), 0xF1C40F);
  store.paie = { at: Date.now(), ...dernierReleve };
  save();
  await interaction.update(salairesPayload());
}

// ── Crédit / remboursement : le joueur demande, le staff verse ou encaisse en jeu puis valide dans un ticket ──
const OP = {
  credit: { titre: 'Demande de crédit', label: 'Montant du crédit (€)', ok: '✅ Crédit versé en jeu', log: '💳 Crédit accordé' },
  remb:   { titre: 'Remboursement', label: 'Montant remboursé (€)', ok: '✅ Remboursement reçu en jeu', log: '💶 Remboursement reçu' },
};
// Plafond vérifié à la demande ET à la validation (la cagnotte ou la caisse a pu bouger entre-temps)
const plafond = (type, uid) => type === 'credit'
  ? Math.min(cagnotte(uid), Math.round(dernierReleve?.caisse ?? Infinity))
  : dette(uid);

async function handleOpButton(interaction) {
  const type = interaction.customId.slice(5), uid = interaction.user.id;
  if (!store.membres[uid] || store.membres[uid].fin <= Date.now()) return rep(interaction, '🪪 Réservé aux membres **LICENCIÉS** de l\'association.');
  const op = (store.ops ||= {})[uid];
  if (op && await interaction.client.channels.fetch(op.ticketId).catch(() => null)) return rep(interaction, '⏳ Tu as déjà une demande en cours : <#' + op.ticketId + '>');
  const max = plafond(type, uid);
  if (max <= 0) return rep(interaction, type === 'credit'
    ? '🐷 Ta cagnotte est vide (ou la caisse de l\'association aussi) : travaille pour l\'association pour la remplir.'
    : '💶 Tu n\'as aucun crédit à rembourser.');
  await interaction.showModal(new ModalBuilder().setCustomId('asso_opmodal_' + type).setTitle(OP[type].titre).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('montant').setLabel((OP[type].label + ' · max ' + max).slice(0, 45))
      .setStyle(TextInputStyle.Short).setMaxLength(12).setRequired(true).setPlaceholder(String(max)))));
}

async function handleOpModal(interaction) {
  const type = interaction.customId.slice(13), uid = interaction.user.id, m = store.membres[uid];
  if (!m) return rep(interaction, '🪪 Réservé aux membres **LICENCIÉS** de l\'association.');
  const montant = Number(interaction.fields.getTextInputValue('montant').replace(/[\s€.]/g, ''));
  const max = plafond(type, uid);
  if (!Number.isInteger(montant) || montant <= 0) return rep(interaction, '❌ Indique un montant en euros, sans virgule (ex : 15000).');
  if (montant > max) return rep(interaction, '❌ Maximum possible : **' + euros(max) + '**.');
  let ticket;
  try {
    ticket = await require('../moderation/tickets').ouvrirSalon(interaction.guild, interaction.member, {
      prefix: type, objet: OP[type].titre + ' · ' + NOM,
      welcome: type === 'credit' ? 'Le staff va te verser **' + euros(montant) + '** en jeu, puis valider ici.'
        : 'Verse **' + euros(montant) + '** en jeu à la ferme **' + NOM + '**, puis le staff validera ici.',
    });
  } catch (err) {
    console.error('⚠️ Association · ticket :', err.message);
    return rep(interaction, '⚠️ Impossible d\'ouvrir le ticket. Préviens un administrateur.');
  }
  store.ops[uid] = { type, montant, ticketId: ticket.id };
  save();
  await ticket.send({
    ...panneau({ embeds: [{ ...demandeEmbed(uid, m, '⏳ En attente du staff.', 0xF1C40F, type === 'credit'
      ? 'Crédit demandé : **' + euros(montant) + '** · à verser en jeu par l\'association'
      : 'Remboursement : **' + euros(montant) + '** · à verser en jeu à la ferme **' + NOM + '**'), title: (type === 'credit' ? '💳 ' : '💶 ') + OP[type].titre + ' · ' + euros(montant),
      fields: [{ name: '🐷 Cagnotte', value: euros(cagnotte(uid)), inline: true }, { name: '💳 Crédit en cours', value: euros(dette(uid)), inline: true }] }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_opok_' + uid).setLabel(OP[type].ok).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_opno_' + uid).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger))],
    allowedMentions: { parse: [] },
  }).catch(() => null);
  await log(interaction.client, '📝 ' + OP[type].titre + ' · ' + NOM, uid, m.pseudo, 'Montant : **' + euros(montant) + '** · ticket <#' + ticket.id + '>', 0xF1C40F);
  await rep(interaction, '✅ Demande envoyée : <#' + ticket.id + '>');
}

async function handleOpDecision(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  const accepte = interaction.customId.startsWith('asso_opok_'), uid = interaction.customId.slice(10);
  const op = store.ops?.[uid];
  if (!op) return rep(interaction, 'ℹ️ Cette demande a déjà été traitée.');
  if (accepte && op.montant > plafond(op.type, uid)) return rep(interaction, '⚠️ Montant supérieur au maximum actuel (**' + euros(plafond(op.type, uid)) + '**) : refuse la demande.');
  delete store.ops[uid];
  if (accepte) {
    const sens = op.type === 'credit' ? 1 : -1; // crédit : cagnotte → dette ; remboursement : dette → cagnotte
    store.cagnottes[uid] = cagnotte(uid) - sens * op.montant;
    store.credits[uid] = dette(uid) + sens * op.montant;
  }
  save();
  const pseudo = store.membres[uid]?.pseudo || '?';
  const bilan = '🐷 Cagnotte : **' + euros(cagnotte(uid)) + '** · 💳 reste à rembourser : **' + euros(dette(uid)) + '**';
  const statut = (accepte ? OP[op.type].ok + ' · ' : '❌ Refusé · ') + 'par <@' + interaction.user.id + '>\n' + bilan;
  await log(interaction.client, (accepte ? OP[op.type].log : '❌ ' + OP[op.type].titre + ' refusée') + ' · ' + NOM, uid, pseudo,
    'Montant : **' + euros(op.montant) + '** · ' + (accepte ? 'validé' : 'refusé') + ' par <@' + interaction.user.id + '>\n' + bilan, accepte ? 0x2ECC71 : 0xE74C3C);
  await interaction.update({ ...panneau({ embeds: [{ ...demandeEmbed(uid, { pseudo }, statut, accepte ? 0x2ECC71 : 0xE74C3C, 'Montant : **' + euros(op.montant) + '**'), title: OP[op.type].titre + ' · ' + euros(op.montant) }] }), components: [], allowedMentions: { parse: [] } });
  await majSalaires(interaction.client);
}

// ── Virements des joueurs vers l'association (compteur « transfer_in » du mod, clé = ferme qui envoie) ──
// virBase[ferme] = cumul déjà traité ; versements = historique { uid, pseudo, ferme, montant, at }.
// Attribution : licencié connecté dans la ferme qui envoie, sinon licencié dont le pseudo = nom de la ferme.
const mois = t => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
const duMois = uid => (store.versements || []).filter(v => v.uid === uid && mois(v.at) === mois(Date.now())).reduce((a, v) => a + v.montant, 0);
const auTotal = uid => (store.versements || []).filter(v => v.uid === uid).reduce((a, v) => a + v.montant, 0);

function nouveauxVirements(status) {
  const farm = status?.farms?.find(f => f.name === NOM);
  if (!farm) return [];
  const cumuls = status.counters.filter(c => c.kind === 'transfer_in' && c.farm === farm.id);
  store.virBase ||= {}; // compteurs du mod en mémoire : tout ce qui y est date de l'installation du mod
  const membres = actifs();
  const out = [];
  for (const c of cumuls) {
    if (c.value < (store.virBase[c.fillType] || 0)) store.virBase[c.fillType] = 0; // serveur FS25 redémarré : compteur remis à zéro
    const montant = Math.round(c.value - (store.virBase[c.fillType] || 0));
    if (montant < 1) continue;
    store.virBase[c.fillType] = c.value;
    const envoi = Number(c.fillType), ferme = status.farms.find(f => f.id === envoi)?.name || 'Ferme ' + envoi;
    const connectes = new Set((status.playerFarms || []).filter(p => p.farm === envoi).map(p => p.name.toLowerCase()));
    const m = membres.find(([, x]) => connectes.has(x.pseudo.toLowerCase())) || membres.find(([, x]) => x.pseudo.toLowerCase() === ferme.toLowerCase());
    out.push({ uid: m?.[0] || null, pseudo: m?.[1].pseudo || null, ferme, montant, at: Date.now() });
  }
  if (out.length) { (store.versements ||= []).push(...out); save(); }
  return out;
}

async function traiterVirements(client) {
  const nouveaux = nouveauxVirements(require('./fs25-bridge').getLastFs25Status());
  for (const v of nouveaux) {
    const total = v.uid ? auTotal(v.uid) : 0;
    const etat = !v.uid ? '⚠️ Aucun licencié reconnu pour cette ferme (droit d\'entrée, ou pseudo en jeu différent ?) : non compté.'
      : '✅ Total investi : **' + euros(total) + '**';
    await log(client, '💶 Virement reçu · ' + NOM, v.uid || '0', v.pseudo || '?', 'Montant : **' + euros(v.montant) + '** depuis la ferme **' + v.ferme + '**\n' + etat,
      !v.uid ? 0xE67E22 : 0x2ECC71);
  }
  if (nouveaux.length) await majSalaires(client);
}

// Section « Investissement » : chaque licencié, ce qu'il a investi ce mois et au total (+ cagnotte / crédit s'il en a)
function investissement() {
  const lignes = actifs().map(([u, m]) => ({ u, m, total: auTotal(u) })).sort((a, b) => b.total - a.total).slice(0, 40)
    .map(x => '🌲' + ' <@' + x.u + '> · `' + x.m.pseudo + '` · 💶 investi total **' + euros(x.total) + '**'
      + ' · jusqu\'au ' + ts(x.m.fin, 'D'));
  return [
    '## 🌲  MEMBRES LICENCIÉS',
    ...(lignes.length ? lignes : ['_Aucun membre licencié pour le moment._']),
  ];
}

// ── Élection du président ─────────────────────────────────────────────────────
// store.election = { finCandid, finVote, candidats: { uid: pseudo }, votes: { votant: candidat } } ; store.president = { uid, pseudo, at }
// Candidatures 24 h (bouton « Me présenter »), puis vote 48 h (bouton « Voter », licenciés uniquement), puis clôture automatique.
const H = 3600_000, CANDIDATURE = 24 * H, VOTE = 48 * H;
const phase = () => { const e = store.election; if (!e) return null; const t = Date.now(); return t < e.finCandid ? 'candidature' : t < e.finVote ? 'vote' : 'fini'; };
const licencie = uid => (store.membres[uid]?.fin || 0) > Date.now();

function presidentLignes() {
  const e = store.election, ph = phase(), pres = store.president;
  const noms = e ? Object.entries(e.candidats).map(([u, n]) => '> • <@' + u + '> · `' + n + '`') : [];
  return [
    '## 👑  PRÉSIDENT',
    pres ? '👑 <@' + pres.uid + '> · `' + pres.pseudo + '` · élu ' + ts(pres.at, 'D') : '_Pas de président pour le moment._',
    '-# Il gère les achats et les parcelles à travailler, selon le code de l\'association.',
    ...(ph === 'candidature' ? ['', '🗳️ **Élection · candidatures ouvertes** jusqu\'à ' + ts(e.finCandid, 'R') + ' (vote ensuite pendant 48 h)', ...(noms.length ? noms : ['_Aucun candidat pour le moment._'])]
      : ph === 'vote' ? ['', '🗳️ **Élection · vote ouvert** jusqu\'à ' + ts(e.finVote, 'R') + ' · ' + Object.keys(e.votes).length + ' vote(s)', ...noms] : []),
  ];
}

const boutonsElection = () => phase() === 'candidature' ? [new ButtonBuilder().setCustomId('asso_elec_candidat').setLabel('🙋 Me présenter').setStyle(ButtonStyle.Primary)]
  : phase() === 'vote' ? [new ButtonBuilder().setCustomId('asso_elec_vote').setLabel('🗳️ Voter').setStyle(ButtonStyle.Primary)] : [];

async function handleAdmin(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  const ph = phase();
  await interaction.reply({ flags: 64, allowedMentions: { parse: [] },
    content: '⚙️ **Administratif** · ' + (store.president ? 'Président : <@' + store.president.uid + '>' : 'pas de président') + '\n'
      + (ph ? '🗳️ Une élection est déjà en cours (' + (ph === 'candidature' ? 'candidatures' : 'vote') + ').' : 'Aucune élection en cours.'),
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('asso_elec_lancer').setLabel('🗳️ Lancer une élection').setStyle(ButtonStyle.Success).setDisabled(!!ph))] });
}

async function handleLancer(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  if (phase()) return rep(interaction, '⚠️ Une élection est déjà en cours.');
  const t = Date.now();
  store.election = { finCandid: t + CANDIDATURE, finVote: t + CANDIDATURE + VOTE, candidats: {}, votes: {} };
  save();
  await log(interaction.client, '🗳️ Élection lancée · ' + NOM, '0', '', 'Lancée par <@' + interaction.user.id + '> · candidatures jusqu\'à ' + ts(store.election.finCandid, 'f') + ', vote jusqu\'à ' + ts(store.election.finVote, 'f') + '.', 0x3498DB);
  await interaction.update({ content: '✅ Élection lancée : candidatures 24 h, puis vote 48 h.', components: [] });
  await majSalaires(interaction.client);
}

async function handleCandidat(interaction) {
  const uid = interaction.user.id;
  if (phase() !== 'candidature') return rep(interaction, '⏱️ Les candidatures sont terminées.');
  if (!licencie(uid)) return rep(interaction, '🪪 Seuls les **licenciés** peuvent se présenter.');
  if (store.election.candidats[uid]) return rep(interaction, '✅ Tu es déjà candidat.');
  store.election.candidats[uid] = store.membres[uid].pseudo;
  save();
  await rep(interaction, '🙋 Candidature enregistrée. Le vote s\'ouvre ' + ts(store.election.finCandid, 'R') + '.');
  await majSalaires(interaction.client);
}

async function handleVoteBouton(interaction) {
  const uid = interaction.user.id, e = store.election;
  if (phase() !== 'vote') return rep(interaction, '⏱️ Le vote n\'est pas ouvert.');
  if (!licencie(uid)) return rep(interaction, '🪪 Seuls les **licenciés** peuvent voter.');
  const cands = Object.entries(e.candidats);
  if (!cands.length) return rep(interaction, '⚠️ Aucun candidat : l\'élection sera close sans président.');
  await interaction.reply({ flags: 64, content: '🗳️ Choisis ton candidat (tu peux changer ton vote jusqu\'à ' + ts(e.finVote, 't') + ').' + (e.votes[uid] ? '\nVote actuel : <@' + e.votes[uid] + '>' : ''), allowedMentions: { parse: [] },
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('asso_elec_choix').setPlaceholder('Candidat…')
      .addOptions(cands.slice(0, 25).map(([u, n]) => ({ label: n, value: u }))))] });
}

async function handleVoteChoix(interaction) {
  const uid = interaction.user.id, choix = interaction.values[0];
  if (phase() !== 'vote') return interaction.update({ content: '⏱️ Le vote est terminé.', components: [] });
  if (!licencie(uid) || !store.election.candidats[choix]) return interaction.update({ content: '❌ Vote refusé.', components: [] });
  store.election.votes[uid] = choix;
  save();
  await interaction.update({ content: '✅ Vote enregistré pour <@' + choix + '>.', components: [], allowedMentions: { parse: [] } });
  await majSalaires(interaction.client);
}

// Clôture : le plus de voix gagne (égalité : le premier inscrit) ; sans vote, le président en place reste
async function clotureElection(client) {
  const e = store.election;
  if (!e || phase() !== 'fini') return;
  const voix = {};
  for (const c of Object.values(e.votes)) voix[c] = (voix[c] || 0) + 1;
  const gagnant = Object.keys(e.candidats).sort((x, y) => (voix[y] || 0) - (voix[x] || 0))[0];
  store.election = null;
  if (gagnant && voix[gagnant]) store.president = { uid: gagnant, pseudo: e.candidats[gagnant], at: Date.now() };
  save();
  const resultat = Object.keys(e.candidats).map(u => '• <@' + u + '> · ' + (voix[u] || 0) + ' voix').join('\n') || '_Aucun candidat._';
  await log(client, '👑 Élection terminée · ' + NOM, '0', '', (gagnant && voix[gagnant] ? 'Nouveau président : <@' + gagnant + '> (' + voix[gagnant] + ' voix)' : 'Aucun vote : pas de changement de président.') + '\n' + resultat, 0xF1C40F);
  await majSalaires(client);
}

let phaseAffichee;
async function suiviElection(client) {
  const ph = phase();
  if (ph === 'fini') return clotureElection(client);
  if (ph !== phaseAffichee) { phaseAffichee = ph; await majSalaires(client); } // bascule candidatures -> vote : change le bouton
}


// ── Contrôle des licences : un joueur connecté dans la ferme de l'association sans licence valide → alerte dans les logs ──
// Une alerte par connexion (le joueur est oublié quand il se déconnecte ou quitte la ferme).
const alertes = new Set();
function sansLicence(status) {
  const farm = status?.farms?.find(f => f.name === NOM);
  if (!farm || !status.playerFarms) return null;
  const valides = new Set(actifs().map(([, m]) => m.pseudo.toLowerCase()));
  return status.playerFarms.filter(p => p.farm === farm.id && !valides.has(p.name.toLowerCase())).map(p => p.name);
}

async function verifierLicences(client) {
  const fautifs = sansLicence(require('./fs25-bridge').getLastFs25Status());
  if (!fautifs) return;
  for (const n of [...alertes]) if (!fautifs.includes(n)) alertes.delete(n);
  for (const nom of fautifs) {
    if (alertes.has(nom)) continue;
    alertes.add(nom);
    const ancien = Object.entries(store.membres).find(([, m]) => m.pseudo.toLowerCase() === nom.toLowerCase());
    await log(client, '🚫 Joueur sans licence · ' + NOM, '0', '', '**' + nom + '** connecté dans la ferme sans licence valide · '
      + (ancien ? 'licence de <@' + ancien[0] + '> expirée le ' + ts(ancien[1].fin, 'D') : 'aucune licence enregistrée pour ce pseudo') + ' · adhésion de **' + euros(PRIX) + '** dans <#' + CHANNEL_ID + '>', 0xE74C3C);
  }
}

async function publier(client, status) {
  load();
  if (status) dernierReleve = releve(status);
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!ch) return console.error('⚠️ Association : salon introuvable');
  const get = id => id && ch.messages.fetch(id).catch(() => null);
  if (store.journalMsgId) { (await get(store.journalMsgId))?.delete().catch(() => {}); store.journalMsgId = null; save(); } // ancien HUB « MEMBRES LICENCIÉS »
  const msgs = [['panelMsgId', panelPayload], ['salairesMsgId', salairesPayload]];
  const trouves = await Promise.all(msgs.map(([k]) => get(store[k])));
  if (trouves.every(Boolean)) {
    for (const [i, [, p]] of msgs.entries()) await trouves[i].edit(p()).catch(() => {});
  } else { // ordre cassé ou nouveau message : on reposte tout dans le bon ordre
    const anciens = await ch.messages.fetch({ limit: 50 }).catch(() => null); // aussi les HUB publiés par une autre instance (données séparées)
    for (const m of anciens?.values() || []) if (m.author.id === client.user.id && !m.flags.has(64)) await m.delete().catch(() => {});
    for (const [k, p] of msgs) store[k] = (await ch.send(p())).id;
    save();
  }
}

async function startAssociation(client) {
  try { await publier(client); console.log('🌲 Association · prêt (' + actifs().length + ' membre(s))'); }
  catch (err) { console.error('⚠️ Association :', err.message); }
  setInterval(() => expirer(client).catch(() => {}), 6 * 3600_000).unref(); // logge et retire les licences expirées
  setInterval(() => majSalaires(client).catch(() => {}), 5 * 60_000).unref();
  setInterval(() => verifierLicences(client).catch(() => {}), 60_000).unref();
  setInterval(() => suiviElection(client).catch(() => {}), 60_000).unref(); // bascule candidatures -> vote -> clôture
  setInterval(() => traiterVirements(client).catch(() => {}), 60_000).unref();
}

module.exports = { startAssociation, publier, handle, releve, calcul, sansLicence, nouveauxVirements, duMois, _suivi: suiviElection, _store: () => store, _setReleve: r => { dernierReleve = r; } };
