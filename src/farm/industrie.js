// Niveaux d'industrie d'une exploitation. Le niveau est décidé par le staff : le joueur fait une demande de niveau supérieur,
// un ticket s'ouvre (exploitation, niveau demandé, prix), le staff valide ou refuse. Validé = le niveau monte.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const exp = require('./exploitation');
const { panneau } = require('../core/embed-format');
const { agrilog } = require('../core/agrilog');

const NIVEAUX = [
  ['Artisan', 50000], ['Atelier', 200000], ['Petite entreprise', 350000], ['PME', 500000], ['Manufacture', 650000],
  ['Industriel', 800000], ['Groupe industriel', 950000], ['Grand groupe', 1100000], ['Conglomérat', 1250000], ["Magnat de l'industrie", 1400000],
];
const eur = n => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €';
const ligne = k => '**Nv ' + (k + 1) + ' · ' + NIVEAUX[k][0] + '** → ' + (k + 1) + ' usine' + (k ? 's' : '') + ' — 💶 ' + eur(NIVEAUX[k][1]);
const nomNiveau = n => n ? 'Nv ' + n + ' · ' + NIVEAUX[n - 1][0] : 'Aucun niveau';

const REGLES = [
  '• Chaque niveau se paie **par virement à l\'association**',
  '• Le niveau est validé par le staff après réception du virement',
  '• On passe les niveaux dans l\'ordre, sans en sauter',
  '• Le prix d\'achat des usines dans le jeu reste à votre charge',
];

// Texte du bouton : la liste, avec le niveau actuel de l'exploitation (✅ déjà atteints, ▶️ niveau actuel)
function texte(e) {
  const niv = e?.industrie || 0;
  const lignes = NIVEAUX.map((_, k) => (e ? (k + 1 < niv ? '✅ ' : k + 1 === niv ? '▶️ ' : '▫️ ') : '') + ligne(k) + (e && k + 1 === niv ? '  **← NIVEAU ACTUEL**' : ''));
  return ['**🏭 NIVEAUX D\'INDUSTRIE**' + (e ? ' · ' + e.nom : ''), '━━━━━━━━━━━━━━',
    ...(e ? ['**Niveau actuel :** ' + nomNiveau(niv) + (niv ? ' (' + niv + ' usine' + (niv > 1 ? 's' : '') + ')' : ''), ''] : []),
    ...lignes, '━━━━━━━━━━━━━━', ...REGLES].join('\n');
}

// Exploitation concernée par le clic : celle du salon privé, sinon l'unique exploitation gérée par le joueur
function exploitationDe(i) {
  const all = exp.getAll();
  const salon = all.find(e => e.salonId === i.channelId);
  if (salon) return { e: salon };
  const miennes = all.filter(e => exp.isManager(e, i.user.id));
  return miennes.length === 1 ? { e: miennes[0] } : { multi: miennes.length > 1 };
}

const peutGerer = (i, e) => exp.isManager(e, i.user.id) || i.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
const estStaff = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator) || require('../moderation/tickets').estSupport(i.member);

// Bouton « 🏭 Industrie »
async function afficher(i) {
  const { e, multi } = exploitationDe(i);
  const embed = { description: texte(e) + (multi ? '\n\n_Tu gères plusieurs exploitations : ouvre ce bouton depuis le salon de l\'exploitation pour voir son niveau._' : ''), color: 0xE67E22 };
  const components = [];
  if (e && peutGerer(i, e)) {
    const niv = e.industrie || 0;
    if (niv >= NIVEAUX.length) embed.description += '\n\n🏆 Niveau maximum atteint.';
    else if (e.industrieDemande) embed.description += '\n\n⏳ Une demande de **' + nomNiveau(e.industrieDemande.niveau) + '** est en attente du staff' + (e.industrieDemande.ticketId ? ' : <#' + e.industrieDemande.ticketId + '>' : '') + '.';
    else components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ind_req_' + e.id).setLabel('⬆️ Demander le niveau ' + (niv + 1) + ' · ' + eur(NIVEAUX[niv][1])).setStyle(ButtonStyle.Primary)));
  }
  i._intro = true; // texte complet : pas d'intro /bouton-info en tête
  return i.reply({ natif: true, ...panneau({ embeds: [embed] }), components, flags: 64 });
}

// Le joueur demande le niveau suivant : ticket pour le staff
async function demander(i) {
  const e = exp.getById(i.customId.replace('ind_req_', ''));
  if (!e) return i.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  if (!peutGerer(i, e)) return i.reply({ content: '❌ Seul un exploitant peut faire cette demande.', flags: 64 });
  const niv = (e.industrie || 0) + 1;
  if (niv > NIVEAUX.length) return i.update({ natif: true, content: '', embeds: [{ description: '🏆 Niveau maximum atteint.', color: 0xE67E22 }], components: [] });
  if (e.industrieDemande) return i.reply({ content: '⏳ Une demande est déjà en attente du staff.', flags: 64 });

  await i.deferUpdate();
  let ticket;
  try {
    ticket = await require('../moderation/tickets').ouvrirSalon(i.guild, i.member, {
      prefix: 'industrie', objet: 'Niveau d\'industrie', welcome: 'Ta demande de niveau d\'industrie est juste en dessous. Le staff la traite dans ce salon.',
    });
  } catch (err) {
    console.error('⚠️ Industrie — ticket :', err.message);
    return i.editReply({ natif: true, content: '⚠️ Impossible d\'ouvrir le ticket. Préviens un administrateur.', embeds: [], components: [] });
  }
  const msg = await ticket.send({
    ...panneau({ embeds: [{
      title: '🏭 Demande de niveau d\'industrie',
      description: '<@' + i.user.id + '> demande le **niveau ' + niv + '** pour son exploitation.',
      fields: [
        { name: 'Exploitation', value: e.nom, inline: true },
        { name: 'Niveau demandé', value: nomNiveau(niv) + ' (' + niv + ' usine' + (niv > 1 ? 's' : '') + ')', inline: true },
        { name: 'Prix', value: eur(NIVEAUX[niv - 1][1]), inline: true },
        { name: 'Niveau actuel', value: nomNiveau(e.industrie || 0), inline: true },
      ],
      color: 0xE67E22,
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ind_ok_' + e.id + '_' + niv).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ind_no_' + e.id + '_' + niv).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { parse: [] },
  });
  exp.updateExploitation(e.id, { industrieDemande: { niveau: niv, ticketId: ticket.id, msgId: msg.id, userId: i.user.id } });
  await agrilog(i.guild, '🏭 **' + e.nom + '** demande le niveau d\'industrie : ' + nomNiveau(niv) + ' (' + eur(NIVEAUX[niv - 1][1]) + ')');
  await i.editReply({ natif: true, content: '', embeds: [{ description: '✅ Demande transmise au staff : <#' + ticket.id + '>', color: 0x2ECC71 }], components: [] });
}

// Le staff valide ou refuse
async function decider(i) {
  if (!estStaff(i)) return i.reply({ content: '❌ Réservé au staff.', flags: 64 });
  const [, oui, reste] = i.customId.match(/^ind_(ok|no)_(.+)$/);
  const k = reste.lastIndexOf('_');
  const e = exp.getById(reste.slice(0, k)), niv = Number(reste.slice(k + 1));
  if (!e || !e.industrieDemande || e.industrieDemande.niveau !== niv) return i.update({ components: [], content: 'ℹ️ Demande déjà traitée ou obsolète.' });
  const demandeur = e.industrieDemande.userId;
  exp.updateExploitation(e.id, oui === 'ok' ? { industrie: niv, industrieDemande: null } : { industrieDemande: null });
  await i.update({ components: [], content: (oui === 'ok' ? '✅ Validé : **' + e.nom + '** passe **' + nomNiveau(niv) + '**' : '❌ Refusé') + ' par <@' + i.user.id + '> · <@' + demandeur + '>', allowedMentions: { users: [demandeur] } });
  await agrilog(i.guild, oui === 'ok'
    ? '✅ Industrie validée : **' + e.nom + '** passe **' + nomNiveau(niv) + '** (' + eur(NIVEAUX[niv - 1][1]) + ') · par **' + (i.member?.displayName || i.user.username) + '**'
    : '❌ Industrie refusée : **' + e.nom + '** niveau **' + nomNiveau(niv) + '** · par **' + (i.member?.displayName || i.user.username) + '**');
  require('./salon-exploitation').ensure(i.client, exp.getById(e.id)).catch(() => {}); // le HUB du salon affiche le nouveau niveau
}

async function handle(i) {
  try {
    if (i.customId.startsWith('ind_req_')) return await demander(i);
    return await decider(i);
  } catch (err) { console.error('Erreur industrie :', err.stack || err.message); }
}

module.exports = { afficher, handle, nomNiveau, NIVEAUX };
