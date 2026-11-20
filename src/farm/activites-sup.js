// Activités supplémentaires d'une exploitation : activité 1 (cultures) et activité 2 (élevage) sont gratuites,
// les suivantes s'achètent par palier de PRIX_PALIER : 1ʳᵉ achetée = 1 palier, 2ᵉ = 2 paliers, etc.
// Le joueur choisit l'activité, paie la somme à l'association, un ticket s'ouvre et l'administrateur valide (oui / non).
// Activités achetées : champ activitesSup (liste de noms) ; demande en attente : champ activiteSupDemande.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const exp = require('./exploitation');
const { panneau } = require('../core/embed-format');
const { CHOIX, ELEVAGE_INDIV, parNom } = require('./droits-texte');
const { logsSalon } = require('../core/logs-salon');

const PRIX_PALIER = 125000;
const eur = n => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';
const peutGerer = (i, e) => exp.isManager(e, i.user.id) || i.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
const estStaff = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator) || require('../moderation/tickets').estSupport(i.member);

const possedees = e => [e.activitePrincipale, e.activiteSecondaire, ...(e.activitesSup || []), e.activiteSupplementaire].filter(Boolean);
const prix = e => PRIX_PALIER * ((e.activitesSup || []).length + 1);
// Cultures (liste 1) + chaque élevage individuel, sans celles que l'exploitation a déjà
const achetables = e => [...CHOIX.filter(a => a.type === 1), ...ELEVAGE_INDIV].filter(a => !possedees(e).includes(a.nom));

// 1. Menu « Activité supplémentaire » du HUB de gestion
async function proposer(i, e) {
  const sup = e.activitesSup || [];
  const lignes = [
    '🥇 **Activité 1** et 🥈 **Activité 2** (premier élevage) : gratuites.',
    'Les activités suivantes s\'achètent par palier de **' + eur(PRIX_PALIER) + '**.',
    '',
    '**Déjà achetées :** ' + (sup.length ? sup.join(' · ') : '*aucune*'),
    '**Prochaine activité :** ' + eur(prix(e)),
  ];
  const list = achetables(e);
  if (e.activiteSupDemande) lignes.push('', '⏳ Une demande (**' + e.activiteSupDemande.nom + '**) est en attente du staff' + (e.activiteSupDemande.ticketId ? ' : <#' + e.activiteSupDemande.ticketId + '>' : '') + '.');
  const components = !e.activiteSupDemande && list.length
    ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('asup_sel_' + e.id).setPlaceholder('Choisis l\'activité à acheter…')
      .addOptions(list.map(a => ({ label: a.nom, value: a.nom, emoji: { name: a.emoji } }))))]
    : [];
  return i.update({ natif: true, embeds: [{ title: '🥉 Activité supplémentaire · ' + e.nom, description: lignes.join('\n'), color: 0xE67E22 }], components });
}

// 2. Activité choisie : ticket pour le staff
async function demander(i) {
  const e = exp.getById(i.customId.replace('asup_sel_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  if (!peutGerer(i, e)) return i.reply({ content: '❌ Seul un exploitant peut faire cette demande.', flags: 64 });
  if (e.activiteSupDemande) return i.reply({ content: '⏳ Une demande est déjà en attente du staff.', flags: 64 });
  const nom = i.values[0];
  if (!achetables(e).some(a => a.nom === nom)) return i.reply({ content: '❌ Activité indisponible.', flags: 64 });
  const montant = prix(e);

  await i.deferUpdate();
  let ticket;
  try {
    ticket = await require('../moderation/tickets').ouvrirSalon(i.guild, i.member, {
      prefix: 'activite', objet: 'Activité supplémentaire', welcome: 'Ta demande d\'activité supplémentaire est juste en dessous. Le staff la traite dans ce salon.',
    });
  } catch (err) {
    console.error('⚠️ Activité supplémentaire — ticket :', err.message);
    return i.editReply({ natif: true, content: '⚠️ Impossible d\'ouvrir le ticket. Préviens un administrateur.', embeds: [], components: [] });
  }
  const msg = await ticket.send({
    ...panneau({ embeds: [{
      title: '🥉 Demande d\'activité supplémentaire',
      description: '<@' + i.user.id + '> demande une activité supplémentaire pour son exploitation.',
      fields: [
        { name: 'Exploitation', value: e.nom, inline: true },
        { name: 'Activité demandée', value: nom, inline: true },
        { name: 'Prix à payer à l\'association', value: eur(montant), inline: true },
        { name: 'Déjà achetées', value: (e.activitesSup || []).join(' · ') || 'Aucune', inline: false },
      ],
      color: 0xE67E22,
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('asup_ok_' + e.id).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('asup_no_' + e.id).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { parse: [] },
  });
  exp.updateExploitation(e.id, { activiteSupDemande: { nom, prix: montant, ticketId: ticket.id, msgId: msg.id, userId: i.user.id } });
  await logsSalon(i.client, '🥉 **' + e.nom + '** demande l\'activité supplémentaire **' + nom + '** (' + eur(montant) + ')');
  await i.editReply({ natif: true, content: '', embeds: [{ description: '✅ Demande transmise au staff : <#' + ticket.id + '>\n💶 Verse **' + eur(montant) + '** à l\'association : l\'activité est ajoutée une fois la demande validée.', color: 0x2ECC71 }], components: [] });
}

// 3. Le staff valide ou refuse
async function decider(i) {
  if (!estStaff(i)) return i.reply({ content: '❌ Réservé au staff.', flags: 64 });
  const [, oui, id] = i.customId.match(/^asup_(ok|no)_(.+)$/);
  const e = exp.getById(id), d = e?.activiteSupDemande;
  if (!d) return i.update({ components: [], content: 'ℹ️ Demande déjà traitée ou obsolète.' });
  exp.updateExploitation(e.id, oui === 'ok'
    ? { activitesSup: [...(e.activitesSup || []), d.nom], activiteSupDemande: null }
    : { activiteSupDemande: null });
  await i.update({ components: [], content: (oui === 'ok' ? '✅ Validé : **' + e.nom + '** obtient **' + d.nom + '**' : '❌ Refusé : **' + d.nom + '**') + ' par <@' + i.user.id + '> · <@' + d.userId + '>', allowedMentions: { users: [d.userId] } });
  await logsSalon(i.client, (oui === 'ok' ? '✅ Activité supplémentaire validée' : '❌ Activité supplémentaire refusée') + ' : **' + e.nom + '** · **' + d.nom + '** (' + eur(d.prix) + ') · par **' + (i.member?.displayName || i.user.username) + '**');
  require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {}); // le panneau des droits du salon est mis à jour
}

async function handle(i) {
  try {
    if (i.isStringSelectMenu()) return await demander(i);
    return await decider(i);
  } catch (err) { console.error('Erreur activité supplémentaire :', err.stack || err.message); }
}

module.exports = { handle, proposer, possedees, PRIX_PALIER };
