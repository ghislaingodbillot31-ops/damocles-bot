// Bouton « 👑 Administrateur » du salon d'une exploitation : crédit fictif en jeu, à rembourser obligatoirement.
// Le bot ne donne pas l'argent en jeu : il garde la dette de l'exploitation (champ credit, en €) et son historique.
// Attribuer un crédit = la dette monte · Remboursement anticipé = la dette baisse (jamais sous 0).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const exp = require('./exploitation');
const { logsSalon } = require('../core/logs-salon');

const eur = n => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';
const estAdmin = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator);
const LABEL = { attribuer: 'Attribuer un crédit', rembourser: 'Remboursement anticipé' };

// Texte affiché dans le HUB du salon (vide tant que l'exploitation n'a jamais eu de crédit)
const MAX_AVERT = 3; // à ce nombre d'avertissements, les joueurs de l'exploitation sont expulsés du serveur
const nbAvert = e => (e.avertissements || []).length;
const ligneCredit = e => (e.credit > 0 ? '\n💳 **Crédit à rembourser :** ' + eur(e.credit) : '')
  + (nbAvert(e) ? '\n⚠️ **Avertissements :** ' + nbAvert(e) + ' / ' + MAX_AVERT : '');

// 1. Clic sur « 👑 Administrateur » : menu à deux options (visible par l'admin seul)
async function ouvrir(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const e = exp.getById(i.customId.replace('cred_admin_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  return i.reply({
    embeds: [{ title: '👑 Administrateur · ' + e.nom, description: '💳 **Crédit à rembourser :** ' + eur(e.credit || 0) + '\n⚠️ **Avertissements :** ' + nbAvert(e) + ' / ' + MAX_AVERT + '\n\nChoisis une action :', color: 0xF1C40F }],
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cred_sel_' + e.id).setPlaceholder('Que veux-tu faire ?')
      .addOptions([...Object.entries(LABEL).map(([value, label]) => ({ label, value, description: value === 'attribuer' ? 'Choisir un montant' : 'Choisir le montant remboursé' })),
        { label: '👤 Attribuer à un joueur', value: 'proprio', description: 'Donne cette exploitation, son salon et son HUB à un joueur' },
        { label: '⚠️ Avertissement', value: 'avertir', description: 'Avertir l\'exploitation avec une raison · expulsion au 3e' },
        { label: '🔄 RESET', value: 'reset', description: 'Remet à zéro crédit, niveau industriel et activités (propriétaire intact)' }]))],
    flags: 64,
  });
}

// 2. Choix de l'action : fenêtre pour saisir le montant
async function choisir(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const id = i.customId.replace('cred_sel_', ''), mode = i.values[0];
  if (mode === 'proprio') return i.update({ // le sélecteur est traité par hub.handleHubExplAdmOwner (transfert + salon + HUB)
    embeds: [{ title: '👤 Attribuer ' + (exp.getById(id)?.nom || '?'), description: 'Choisis le **nouveau propriétaire** : il reçoit l\'exploitation, le salon privé et le HUB de gestion. L\'ancien propriétaire perd l\'accès.', color: 0xE67E22 }],
    components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('hub_expl_admowner_' + id).setPlaceholder('Choisis le joueur').setMinValues(1).setMaxValues(1))],
  });
  if (mode === 'reset') return i.update({
    embeds: [{ title: '⚠️ Confirmer le RESET', description: 'Remettre à zéro **crédit**, **niveau industriel** et **activités** de **' + (exp.getById(id)?.nom || '?') + '** ?\nLe propriétaire, les co-exploitants et les ouvriers ne changent pas. Action **irréversible**.', color: 0xE74C3C }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cred_reset_' + id).setLabel('🔄 Confirmer le RESET').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cred_resetno_' + id).setLabel('Annuler').setStyle(ButtonStyle.Secondary))],
  });
  if (mode === 'avertir') return i.showModal(new ModalBuilder().setCustomId('cred_modal_avertir_' + id).setTitle('Avertissement · ' + (exp.getById(id)?.nom || '').slice(0, 30)).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('raison').setLabel('Raison de l\'avertissement').setStyle(TextInputStyle.Paragraph)
      .setMinLength(3).setMaxLength(300).setRequired(true))));
  if (!LABEL[mode]) return;
  return i.showModal(new ModalBuilder().setCustomId('cred_modal_' + mode + '_' + id).setTitle(LABEL[mode]).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('montant').setLabel('Montant en €').setStyle(TextInputStyle.Short)
      .setPlaceholder('ex. 50000').setRequired(true).setMaxLength(12))));
}

// 3. Montant saisi : la dette est mise à jour, enregistrée dans les logs et affichée dans le HUB
async function valider(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const [, mode, id] = i.customId.match(/^cred_modal_(attribuer|rembourser)_(.+)$/) || [];
  const e = id && exp.getById(id);
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  const montant = Math.round(Number(i.fields.getTextInputValue('montant').replace(/[\s  €]/g, '').replace(',', '.')));
  if (!(montant > 0) || montant > 1e9) return i.reply({ content: '❌ Montant invalide.', flags: 64 });
  const avant = e.credit || 0;
  if (mode === 'rembourser' && montant > avant) return i.reply({ content: '❌ Remboursement de ' + eur(montant) + ' supérieur au crédit en cours (' + eur(avant) + ').', flags: 64 });
  const apres = mode === 'attribuer' ? avant + montant : avant - montant;
  const histo = [...(e.creditHisto || []), { date: new Date().toISOString(), type: mode, montant, par: i.user.id }].slice(-30);
  exp.updateExploitation(e.id, { credit: apres, creditHisto: histo });
  const par = i.member?.displayName || i.user.username;
  await logsSalon(i.client, mode === 'attribuer'
    ? '💳 Crédit de **' + eur(montant) + '** attribué à **' + e.nom + '** · reste à rembourser **' + eur(apres) + '** · par **' + par + '**'
    : '💳 Remboursement anticipé de **' + eur(montant) + '** · **' + e.nom + '** · reste à rembourser **' + eur(apres) + '** · par **' + par + '**');
  require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {});
  return i.reply({
    embeds: [{ description: (mode === 'attribuer' ? '✅ Crédit de **' + eur(montant) + '** attribué' : '✅ Remboursement de **' + eur(montant) + '** enregistré')
      + ' à **' + e.nom + '**.\n💳 Reste à rembourser : **' + eur(apres) + '**\n\n_L\'argent en jeu est à donner à la main._', color: 0x2ECC71 }],
    flags: 64,
  });
}

// 4. RESET confirmé : crédit, niveau industriel et activités remis à zéro (propriétaire & équipe intacts)
async function reset(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  if (i.customId.startsWith('cred_resetno_')) return i.update({ embeds: [{ description: 'Reset annulé.', color: 0x95A5A6 }], components: [] });
  const e = exp.getById(i.customId.replace('cred_reset_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  exp.updateExploitation(e.id, { credit: 0, creditHisto: [], industrie: 0, industrieDemande: null,
    activitePrincipale: null, activiteSecondaire: null, activiteSupplementaire: null, activitesSup: [], activiteSupDemande: null });
  await logsSalon(i.client, '🔄 RESET de **' + e.nom + '** (crédit, niveau industriel, activités) · par **' + (i.member?.displayName || i.user.username) + '**');
  require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {});
  return i.update({ embeds: [{ description: '✅ **' + e.nom + '** remis à zéro : crédit, niveau industriel et activités. Propriétaire inchangé.', color: 0x2ECC71 }], components: [] });
}

// 5. Avertissement : raison saisie. Les deux premiers sont enregistrés tout de suite ; le 3e demande une confirmation
//    (il expulse du serveur tous les joueurs de l'exploitation : propriétaire, co-exploitants, ouvriers).
const enAttente = new Map(); // « admin|exploitation » -> raison du 3e avertissement, en attente de confirmation

async function avertir(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const e = exp.getById(i.customId.replace('cred_modal_avertir_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  const raison = i.fields.getTextInputValue('raison').trim();
  if (nbAvert(e) + 1 < MAX_AVERT) return appliquer(i, e, raison, false);
  enAttente.set(i.user.id + '|' + e.id, raison);
  return i.reply({
    embeds: [{ title: '⚠️ 3e avertissement · expulsion', color: 0xE74C3C, description: 'Ceci est le **3e avertissement** de **' + e.nom + '**.\nCes joueurs seront **expulsés du serveur** (les administrateurs sont épargnés) :\n'
      + exp.memberIds(e).map(u => '<@' + u + '>').join(' ') + '\n\n**Raison :** ' + raison }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cred_warnok_' + e.id).setLabel('⚠️ Confirmer · avertir et expulser').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cred_warnno_' + e.id).setLabel('Annuler').setStyle(ButtonStyle.Secondary))],
    allowedMentions: { parse: [] }, flags: 64,
  });
}

async function confirmerAvertissement(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const id = i.customId.replace(/^cred_warn(ok|no)_/, '');
  const cle = i.user.id + '|' + id, raison = enAttente.get(cle);
  enAttente.delete(cle);
  if (i.customId.startsWith('cred_warnno_')) return i.update({ embeds: [{ description: 'Avertissement annulé.', color: 0x95A5A6 }], components: [] });
  const e = exp.getById(id);
  if (!e || !raison) return i.update({ embeds: [{ description: '❌ Demande expirée : relance **Avertissement** depuis le menu Administrateur.', color: 0xE74C3C }], components: [] });
  return appliquer(i, e, raison, true);
}

async function appliquer(i, e, raison, maj) {
  const rep = r => (maj ? i.update({ components: [], ...r }) : i.reply({ flags: 64, ...r }));
  const par = i.member?.displayName || i.user.username;
  const liste = [...(e.avertissements || []), { date: new Date().toISOString(), raison, par: i.user.id }];
  if (liste.length < MAX_AVERT) {
    exp.updateExploitation(e.id, { avertissements: liste });
    await logsSalon(i.client, '⚠️ Avertissement **' + liste.length + '/' + MAX_AVERT + '** · **' + e.nom + '** · 💬 ' + raison + ' · par **' + par + '**');
    require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {});
    return rep({ embeds: [{ description: '⚠️ Avertissement **' + liste.length + '/' + MAX_AVERT + '** enregistré pour **' + e.nom + '**.\nRaison : ' + raison, color: 0xF39C12 }] });
  }
  // 3e avertissement : expulsion de tous les joueurs de l'exploitation (un MP leur explique pourquoi, avant)
  const expulses = [], epargnes = [];
  for (const uid of exp.memberIds(e)) {
    const m = await i.guild.members.fetch(uid).catch(() => null);
    if (!m) continue; // déjà parti
    if (m.permissions.has(PermissionFlagsBits.Administrator) || !m.kickable) { epargnes.push(uid); continue; }
    await m.send({ embeds: [{ title: '🚪 Expulsion · ' + MAX_AVERT + ' avertissements', color: 0xE74C3C,
      description: 'Ton exploitation **' + e.nom + '** a reçu **' + MAX_AVERT + ' avertissements** : tu es expulsé du serveur.\n\n' + liste.map((a, n) => (n + 1) + '. ' + a.raison).join('\n') }] }).catch(() => {});
    if (await m.kick(MAX_AVERT + ' avertissements · ' + e.nom + ' · ' + raison).then(() => true, () => false)) expulses.push(uid); else epargnes.push(uid);
  }
  exp.updateExploitation(e.id, { avertissements: [], avertHisto: [...(e.avertHisto || []), ...liste] }); // compteur remis à zéro, historique conservé
  await logsSalon(i.client, '🚪 **' + e.nom + '** · ' + MAX_AVERT + ' avertissements (' + liste.map(a => a.raison).join(' / ') + ') · expulsés : **' + (expulses.length || 'aucun') + '**'
    + (epargnes.length ? ' · non expulsés : ' + epargnes.length : '') + ' · par **' + par + '**');
  require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {});
  return rep({ embeds: [{ color: 0xE74C3C, description: '🚪 **' + e.nom + '** : 3e avertissement.\n**Expulsés (' + expulses.length + ') :** ' + (expulses.map(u => '<@' + u + '>').join(' ') || 'aucun')
    + (epargnes.length ? '\n**Non expulsés (administrateurs ou droits insuffisants) :** ' + epargnes.map(u => '<@' + u + '>').join(' ') : '') + '\nRaison : ' + raison }], allowedMentions: { parse: [] } });
}

async function handle(i) {
  try {
    if (i.isButton() && i.customId.startsWith('cred_warn')) return await confirmerAvertissement(i);
    if (i.isButton() && i.customId.startsWith('cred_reset')) return await reset(i);
    if (i.isButton()) return await ouvrir(i);
    if (i.isStringSelectMenu()) return await choisir(i);
    if (i.isModalSubmit() && i.customId.startsWith('cred_modal_avertir_')) return await avertir(i);
    if (i.isModalSubmit()) return await valider(i);
  } catch (err) { console.error('Erreur crédit :', err.stack || err.message); }
}

module.exports = { handle, ligneCredit };
