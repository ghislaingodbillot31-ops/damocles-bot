// Bouton « 👑 Administrateur » du salon d'une exploitation : crédit fictif en jeu, à rembourser obligatoirement.
// Le bot ne donne pas l'argent en jeu : il garde la dette de l'exploitation (champ credit, en €) et son historique.
// Attribuer un crédit = la dette monte · Remboursement anticipé = la dette baisse (jamais sous 0).
const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const exp = require('./exploitation');
const { logsSalon } = require('../core/logs-salon');

const eur = n => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';
const estAdmin = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator);
const LABEL = { attribuer: 'Attribuer un crédit', rembourser: 'Remboursement anticipé' };

// Texte affiché dans le HUB du salon (vide tant que l'exploitation n'a jamais eu de crédit)
const ligneCredit = e => (e.credit > 0 ? '\n💳 **Crédit à rembourser :** ' + eur(e.credit) : '');

// 1. Clic sur « 👑 Administrateur » : menu à deux options (visible par l'admin seul)
async function ouvrir(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const e = exp.getById(i.customId.replace('cred_admin_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  return i.reply({
    embeds: [{ title: '👑 Administrateur · ' + e.nom, description: '💳 **Crédit à rembourser :** ' + eur(e.credit || 0) + '\n\nChoisis une action :', color: 0xF1C40F }],
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cred_sel_' + e.id).setPlaceholder('Que veux-tu faire ?')
      .addOptions(Object.entries(LABEL).map(([value, label]) => ({ label, value, description: value === 'attribuer' ? 'Choisir un montant' : 'Choisir le montant remboursé' }))))],
    flags: 64,
  });
}

// 2. Choix de l'action : fenêtre pour saisir le montant
async function choisir(i) {
  if (!estAdmin(i)) return i.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
  const id = i.customId.replace('cred_sel_', ''), mode = i.values[0];
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

async function handle(i) {
  try {
    if (i.isButton()) return await ouvrir(i);
    if (i.isStringSelectMenu()) return await choisir(i);
    if (i.isModalSubmit()) return await valider(i);
  } catch (err) { console.error('Erreur crédit :', err.stack || err.message); }
}

module.exports = { handle, ligneCredit };
