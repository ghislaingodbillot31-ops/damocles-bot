const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
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
const PRIX       = 10000;
const DUREE      = 365 * 24 * 3600_000; // licence d'un an (temps réel)
const RENOUV     = 30 * 24 * 3600_000;  // renouvellement possible 30 jours avant l'échéance
const LOGS_ID    = '1571329280410001488'; // logs admin de l'association (logs sur une ligne + message « travail et crédits » mis à jour toutes les 5 min)

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
  const debiteurs = Object.entries(store.credits || {}).filter(([u]) => dette(u) > 0).sort((a, b) => dette(b[0]) - dette(a[0]));
  return panneau({
    embeds: [{
      title: '🌲  [A] LE MECHET',
      description: [
        '*Association de sylviculture*',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        '## 🪓 L\'association',
        '**' + NOM + '** est une exploitation commune dédiée exclusivement aux travaux forestiers.',
        'Le matériel est financé par l\'association et mis à disposition de ses membres licenciés.',
        '',
        '## 🪪 Adhésion',
        '• Droit d\'entrée : **' + euros(PRIX) + '**',
        '• Licence valable **1 an en jeu**',
        '• Accès aux machines et aux travaux forestiers.',
        '',
        'Chaque membre peut également investir dans l\'association par virement depuis sa ferme.',
        '',
        '## 📋 Comment rejoindre ?',
        '1. Clique sur « Rejoindre l\'association » pour ouvrir un ticket avec le staff.',
        '2. Verse **' + euros(PRIX) + '** à **' + NOM + '** (Finances → Transférer de l\'argent).',
        '3. Après vérification, tu obtiens le statut **LICENCIÉ**.',
        '',
        'Renouvellement possible 30 jours avant la fin de la licence.',
        '',
        '## 💰 Travail et crédit',
        'Les membres ne sont pas rémunérés, mais peuvent bénéficier de crédits financés par l\'association.',
        'Le montant est calculé selon le temps de travail effectué par chaque membre.',
        '',
        '## 🏦 Caisse de l\'association',
        'Solde : **' + (dernierReleve ? euros(Math.round(dernierReleve.caisse || 0)) : '_en attente des données du serveur FS25_') + '**',
        '',
        '## 💳 Crédits en cours',
        ...(debiteurs.length ? debiteurs.slice(0, 20).map(([u]) => '• <@' + u + '> · `' + (store.membres[u]?.pseudo || '?') + '` · reste à payer **' + euros(dette(u)) + '**') : ['_Aucun crédit en cours._']),
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '🌲 **Ensemble, faisons grandir notre association forestière !**',
      ].join('\n').slice(0, 4000),
      color: 0x2E7D32,
      footer: { text: 'MonCopainBot · mis à jour toutes les 5 min' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_rejoindre').setLabel('🪓 Rejoindre').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_licence').setLabel('🪪 Ma licence').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('asso_reglement').setLabel('📜 Règlement').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('asso_admin').setLabel('⚙️ Administratif').setStyle(ButtonStyle.Danger),
    ), new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asso_credit').setLabel('💳 Crédit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asso_remb').setLabel('💶 Rembourser').setStyle(ButtonStyle.Primary),
    )],
    allowedMentions: { parse: [] },
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
  if (id === 'asso_admin')      return handleAdmin(interaction);
  if (id === 'asso_reglement')       return handleReglement(interaction);
  if (id === 'asso_reglement_edit')  return handleReglementEdit(interaction);
  if (id === 'asso_reglement_modal') return handleReglementModal(interaction);
  if (id === 'asso_credit' || id === 'asso_remb') return handleOpButton(interaction);
  if (/^asso_opmodal_(credit|remb)$/.test(id))    return handleOpModal(interaction);
  if (/^asso_op(ok|no)_\d+$/.test(id))            return handleOpDecision(interaction);
  if (/^asso_(ok|no)_\d+$/.test(id)) return handleDecision(interaction);
}

// ── Démarrage : panneau puis journal, dans cet ordre ──────────────────────────
// ── Travail et crédits : temps de travail (mod DiscordBridge) → part de chaque licencié → plafond de crédit ──
// Compteurs du mod cumulés depuis son installation : véhicules de l'association moteur allumé (transport, machines…) + tronçonneuse (coupe).
// Plafond de crédit d'un licencié = sa part du travail de tous les licenciés × solde de l'association − ce qu'il doit déjà.

function releve(status) {
  const farm = status?.farms?.find(f => f.name === NOM);
  if (!farm) return null;
  const work = {}, detail = {}; // work[pseudo] = secondes au total ; detail[pseudo] = { v: véhicules, c: tronçonneuse }
  for (const c of status.counters) {
    if (c.farm !== farm.id || (c.kind !== 'work_vehicle' && c.kind !== 'work_chainsaw')) continue;
    const k = c.fillType.toLowerCase();
    work[k] = (work[k] || 0) + c.value;
    (detail[k] ||= { v: 0, c: 0 })[c.kind === 'work_vehicle' ? 'v' : 'c'] += c.value;
  }
  return { work, detail, caisse: farm.money };
}

let dernierReleve = null;
const duree = s => Math.floor(s / 3600) + ' h ' + String(Math.floor(s / 60) % 60).padStart(2, '0');

// Crédits : credits[uid] = € restant à rembourser, ops[uid] = demande en cours { type: 'credit' | 'remb', montant, ticketId } (une seule à la fois).
const dette = uid => Math.round((store.credits ||= {})[uid] || 0);
const rafraichir = () => { dernierReleve = releve(require('./fs25-bridge').getLastFs25Status()) || dernierReleve; };

// Part du travail de chaque licencié valide (cumul), triée du plus au moins actif
function parts() {
  const r = dernierReleve, w = r?.work || {};
  const l = actifs().map(([u, m]) => ({ u, m, s: w[m.pseudo.toLowerCase()] || 0, d: r?.detail?.[m.pseudo.toLowerCase()] || { v: 0, c: 0 } }));
  const total = l.reduce((x, y) => x + y.s, 0);
  return l.map(x => ({ ...x, pct: total ? x.s / total : 0 })).sort((x, y) => y.s - x.s);
}
const creditMax = uid => Math.max(0, Math.round((dernierReleve?.caisse || 0) * (parts().find(x => x.u === uid)?.pct || 0)) - dette(uid));

async function majSalaires(client) {
  rafraichir();
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  const m = ch && store.panelMsgId && await ch.messages.fetch(store.panelMsgId).catch(() => null);
  if (m) await m.edit(panelPayload()).catch(() => {});
  await majTravail(client);
}

// Message « travail et crédits » dans le salon des logs admin, édité sur place toutes les 5 min
function travailPayload() {
  const l = parts(), total = l.reduce((x, y) => x + y.s, 0);
  const st = require('./fs25-bridge').getLastFs25Status();
  const farm = st?.farms?.find(f => f.name === NOM);
  const presents = (st?.playerFarms || []).filter(p => farm && p.farm === farm.id).map(p => p.name);
  const lignes = l.map(x => '<@' + x.u + '> · `' + x.m.pseudo + '` · 🚜 ' + duree(x.d.v) + ' · 🪓 ' + duree(x.d.c) + ' · **' + Math.round(x.pct * 100) + ' %** · 💳 crédit dispo **' + euros(creditMax(x.u)) + '**' + (dette(x.u) ? ' (doit ' + euros(dette(x.u)) + ')' : ''));
  return {
    embeds: [{ title: '📊  TRAVAIL ET CRÉDITS · ' + NOM, color: 0x8D6E63, timestamp: new Date().toISOString(), footer: { text: 'MonCopainBot · mis à jour toutes les 5 min' },
      description: [
        '🏦 Caisse : **' + euros(Math.round(dernierReleve?.caisse || 0)) + '** · ⏱️ travail total des licenciés : **' + duree(total) + '**',
        '🟢 Dans la ferme : ' + (presents.length ? presents.map(n => '`' + n + '`').join(', ') : '_personne_'),
        '',
        ...(lignes.length ? lignes.slice(0, 25) : ['_Aucun licencié._']),
        '',
        '-# 🚜 véhicules de l\'association moteur allumé (transport, machines…) · 🪓 coupe à la tronçonneuse · crédit dispo = part du travail × caisse − dette',
      ].join('\n').slice(0, 4000) }],
    allowedMentions: { parse: [] },
  };
}

async function majTravail(client) {
  const ch = await client.channels.fetch(LOGS_ID).catch(() => null);
  if (!ch || !dernierReleve) return;
  const m = store.travailMsgId && await ch.messages.fetch(store.travailMsgId).catch(() => null);
  if (m) return void await m.edit(travailPayload()).catch(() => {});
  store.travailMsgId = (await ch.send(travailPayload()).catch(() => null))?.id || null;
  save();
}

// ── Crédit / remboursement : le joueur demande, le staff verse ou encaisse en jeu puis valide dans un ticket ──
const OP = {
  credit: { titre: 'Demande de crédit', label: 'Montant du crédit (€)', ok: '✅ Crédit versé en jeu', log: '💳 Crédit accordé' },
  remb:   { titre: 'Remboursement', label: 'Montant remboursé (€)', ok: '✅ Remboursement reçu en jeu', log: '💶 Remboursement reçu' },
};
// Plafond vérifié à la demande ET à la validation (la part du travail ou la caisse a pu bouger entre-temps)
const plafond = (type, uid) => { rafraichir(); return type === 'credit' ? creditMax(uid) : dette(uid); };

async function handleOpButton(interaction) {
  const type = interaction.customId.slice(5), uid = interaction.user.id;
  if (!store.membres[uid] || store.membres[uid].fin <= Date.now()) return rep(interaction, '🪪 Réservé aux membres **LICENCIÉS** de l\'association.');
  const op = (store.ops ||= {})[uid];
  if (op && await interaction.client.channels.fetch(op.ticketId).catch(() => null)) return rep(interaction, '⏳ Tu as déjà une demande en cours : <#' + op.ticketId + '>');
  const max = plafond(type, uid);
  if (max <= 0) return rep(interaction, type === 'credit'
    ? '💳 Aucun crédit disponible : il dépend de ta part du travail et du solde de l\'association. Travaille pour l\'association pour l\'augmenter.'
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
      fields: [{ name: '⏱️ Part du travail', value: Math.round((parts().find(x => x.u === uid)?.pct || 0) * 100) + ' %', inline: true }, { name: '💳 Crédit en cours', value: euros(dette(uid)), inline: true }] }] }),
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
    store.credits[uid] = dette(uid) + (op.type === 'credit' ? 1 : -1) * op.montant; // crédit : dette en plus ; remboursement : dette en moins
  }
  save();
  const pseudo = store.membres[uid]?.pseudo || '?';
  const bilan = '💳 Reste à rembourser : **' + euros(dette(uid)) + '** · crédit encore disponible : **' + euros(creditMax(uid)) + '**';
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

// ── Règlement : texte libre (vide au départ), modifiable par le staff directement depuis Discord ──
async function handleReglement(interaction) {
  await interaction.reply({ flags: 64, allowedMentions: { parse: [] },
    embeds: [{ title: '📜  RÈGLEMENT · ' + NOM, color: 0x8D6E63, description: store.reglement || '_Aucun règlement pour le moment._' }],
    components: estStaff(interaction) ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('asso_reglement_edit').setLabel('✏️ Modifier le règlement').setStyle(ButtonStyle.Primary))] : [] });
}

async function handleReglementEdit(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  await interaction.showModal(new ModalBuilder().setCustomId('asso_reglement_modal').setTitle('Règlement de l\'association').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texte').setLabel('Texte du règlement (Markdown accepté)')
      .setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(false).setValue(store.reglement || ''))));
}

async function handleReglementModal(interaction) {
  if (!estStaff(interaction)) return rep(interaction, '❌ Réservé au staff.');
  store.reglement = interaction.fields.getTextInputValue('texte').trim();
  save();
  await log(interaction.client, '📜 Règlement modifié · ' + NOM, '0', '', 'par <@' + interaction.user.id + '> · ' + store.reglement.length + ' caractères', 0x95A5A6);
  await rep(interaction, '✅ Règlement enregistré. Il s\'affiche avec le bouton **📜 Règlement** du HUB.');
}

// ── Administratif (réservé à l'administration) : travail et crédits des licenciés, en privé ──
const handleAdmin = interaction => estStaff(interaction)
  ? interaction.reply({ ...travailPayload(), flags: 64 })
  : rep(interaction, '❌ Réservé à l\'administration.');


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
  if (store.salairesMsgId) { (await get(store.salairesMsgId))?.delete().catch(() => {}); store.salairesMsgId = null; save(); } // ancien 2e HUB
  const msgs = [['panelMsgId', panelPayload]];
  const trouves = await Promise.all(msgs.map(([k]) => get(store[k])));
  if (trouves.every(Boolean)) {
    for (const [i, [, p]] of msgs.entries()) await trouves[i].edit(p()).catch(() => {});
  } else { // ordre cassé ou nouveau message : on reposte tout dans le bon ordre
    const anciens = await ch.messages.fetch({ limit: 50 }).catch(() => null); // aussi les HUB publiés par une autre instance (données séparées)
    for (const m of anciens?.values() || []) if (m.author.id === client.user.id && !m.flags.has(64)) await m.delete().catch(() => {});
    for (const [k, p] of msgs) store[k] = (await ch.send(p())).id;
    save();
  }
  await majTravail(client);
}

async function startAssociation(client) {
  try { await publier(client); console.log('🌲 Association · prêt (' + actifs().length + ' membre(s))'); }
  catch (err) { console.error('⚠️ Association :', err.message); }
  setInterval(() => expirer(client).catch(() => {}), 6 * 3600_000).unref(); // logge et retire les licences expirées
  setTimeout(() => majSalaires(client).catch(() => {}), 60_000).unref(); // 1er relevé FS25 (les données arrivent juste après le démarrage)
  setInterval(() => majSalaires(client).catch(() => {}), 5 * 60_000).unref();
  setInterval(() => verifierLicences(client).catch(() => {}), 60_000).unref();
  setInterval(() => traiterVirements(client).catch(() => {}), 60_000).unref();
}

module.exports = { startAssociation, publier, handle, releve, parts, creditMax, sansLicence, nouveauxVirements, duMois, _store: () => store, _setReleve: r => { dernierReleve = r; } };
