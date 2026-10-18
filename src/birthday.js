const ids = require('./ids');
const db = require('./database');
const { panneau } = require('./embed-format');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
require('dotenv').config();

const BIRTHDAY_CHANNEL_ID = ids('BIRTHDAY_CHANNEL_ID');
const GENERAL_CHANNEL_ID  = process.env.CHAT_CHANNEL_ID || ids('CHAT_CHANNEL_ID');

const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ── Message d'anniversaire dans #général ──────────────────────────────────────
async function sendBirthdayMessages(client) {
  const members = (await db.getAnniversairesAujourdhui()).filter(db.estVisible);
  if (!members.length) return;

  const guild   = (client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first());
  if (!guild) return;
  const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID) || guild.channels.cache.get(GENERAL_CHANNEL_ID);
  if (!channel) return;

  const today = new Date();

  for (const m of members) {
    const parts = m.anniversaire.split('/');
    const age   = today.getFullYear() - parseInt(parts[2]);

    await channel.send(panneau({
      content: '@everyone',
      allowedMentions: { parse: ['everyone'] },
      embeds: [{
        description: [
          '🎂 **Joyeux anniversaire <@' + m.id + '> !**',
          '',
          '> Toute l\'équipe de **' + guild.name + '** te souhaite un excellent anniversaire ! 🥳',
          '> Tu fêtes aujourd\'hui tes **' + age + ' ans** !',
          '',
          '🎉 Bon anniversaire de la part de toute la communauté !',
        ].join('\n'),
        color: 0xF1C40F,
        footer: { text: 'MonCopainBot' },
        timestamp: new Date().toISOString(),
      }]
    })).catch(console.error);
  }
}

// ── Liste globale : prochain anniversaire en tête + tous les suivants ────────
async function updateBirthdayChannel(client) {
  const guild   = (client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first());
  if (!guild) return;
  const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID);
  if (!channel) return;

  const now    = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Membres visibles avec un anniversaire valide JJ/MM/AAAA
  // (partis / inactifs : date conservée en base, mais plus affichée)
  const all = (await db.getAllMembers())
    .filter(m => db.estVisible(m) && m.anniversaire && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(m.anniversaire));

  // La liste (reconnue à son bouton) est éditée sur place ; les doublons éventuels sont supprimés.
  // Les messages « Joyeux anniversaire » du jour J ne sont jamais touchés.
  const poster = async payload => {
    const liste = [...(await channel.messages.fetch({ limit: 50 }).catch(() => new Map())).values()]
      .filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'anniv_btn')));
    const [courant, ...doublons] = liste;
    for (const d of doublons) await d.delete().catch(() => {});
    return courant ? courant.edit(payload) : channel.send(payload);
  };
  const bouton = () => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('anniv_btn').setLabel('Ajouter ma date').setEmoji('🎂').setStyle(ButtonStyle.Primary))];

  if (!all.length) {
    await poster(panneau({
      components: bouton(),
      embeds: [{
        title: '🎂  ANNIVERSAIRES',
        description: '*Aucun anniversaire enregistré pour le moment.*\n\nClique sur le bouton **Ajouter ma date** ci-dessous.',
        color: 0xF1C40F,
      }]
    })).catch(console.error);
    return;
  }

  // Enrichir chaque anniversaire (prochaine occurrence + âge à venir)
  const list = all.map(m => {
    const [jj, mm, aaaa] = m.anniversaire.split('/').map(Number);
    let next = new Date(now.getFullYear(), mm - 1, jj);
    if (next < today0) next = new Date(now.getFullYear() + 1, mm - 1, jj);
    const jours = Math.round((next - today0) / 86400000);
    return { id: m.id, jj, mm, aaaa, next, jours, age: next.getFullYear() - aaaa, isToday: jours === 0 };
  });

  const dateLongue = e => e.jj + ' ' + MOIS[e.mm].toLowerCase() + ' ' + e.next.getFullYear();

  // Trié du plus proche au plus lointain (par prochaine occurrence)
  list.sort((a, b) => a.next - b.next);

  // En-tête : le plus proche uniquement
  const prochain = list[0];
  const tete = prochain.isToday
    ? '## 🎉 Aujourd\'hui !\n> C\'est l\'anniversaire de <@' + prochain.id + '> : **' + prochain.age + ' ans** 🥳'
    : '## 🎂 Prochain anniversaire\n> **le ' + dateLongue(prochain) + '** de <@' + prochain.id + '>\n'
      + '> dans **' + prochain.jours + ' jour' + (prochain.jours > 1 ? 's' : '') + '**, il/elle aura **' + prochain.age + ' ans**';

  // Listing des suivants, dans l'ordre chronologique (du plus proche au plus lointain)
  const lignes = list.slice(1).map(e => {
    const puce = e.isToday ? '🎉' : '📅';
    const jjmm = (String(e.jj).padStart(2, '0') + ' ' + MOIS[e.mm].toLowerCase()).padEnd(13);
    return puce + ' `' + jjmm + '` <@' + e.id + '>  ·  ' + e.age + ' ans  ·  dans ' + e.jours + ' j';
  });

  // Respecter la limite de 4096 caractères
  let corps = '';
  let affiches = 0;
  for (const l of lignes) {
    if (corps.length + l.length + 1 > 3400) break;
    corps += (corps ? '\n' : '') + l;
    affiches++;
  }
  if (affiches < lignes.length) corps += '\n*… et ' + (lignes.length - affiches) + ' autre(s)*';

  await poster(panneau({
    components: bouton(),
    embeds: [{
      title: '🎂  ANNIVERSAIRES  ·  ' + all.length + ' enregistré' + (all.length > 1 ? 's' : ''),
      description: [
        tete,
        '',
        '**📅 Anniversaires suivants**',
        corps || '*Aucun autre pour le moment.*',
        '',
        '-# Clique sur le bouton ci-dessous pour ajouter ou modifier ta date',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'Mis à jour le ' + now.toLocaleDateString('fr-FR') + ' · MonCopainBot' },
      timestamp: now.toISOString(),
    }]
  })).catch(console.error);

  await require('./nettoyage').epurer(client, channel.id);
  console.log('🎂 Salon anniversaires mis à jour — ' + all.length + ' anniversaire(s)');
}

// ── Tâches cron ───────────────────────────────────────────────────────────────
// La liste du salon anniversaires n'est redessinée que :
//  - à chaque enregistrement /anniversaire (commands/anniversaire.js)
//  - au redémarrage quotidien (dailytasks.js), pour retirer les joueurs partis
function startBirthdayTasks(client, cron) {
  // Tous les jours à minuit : souhaits du jour dans le général
  cron.schedule('0 0 * * *', () => {
    sendBirthdayMessages(client);
    console.log('🎂 Vérification anniversaires du jour');
  }, { timezone: 'Europe/Paris' });

  console.log('🎂 Système anniversaires démarré');
}

// ── Enregistrement d'une date (commande /anniversaire et bouton du salon) ─────
// Retourne un message d'erreur, ou null si la date a été enregistrée.
async function enregistrer(user, dateStr) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr.trim());
  if (!m) return '❌ Format invalide. Utilise `JJ/MM/AAAA` (exemple : `20/11/1988`)';
  const [jour, mois, annee] = [+m[1], +m[2], +m[3]];
  const d = new Date(annee, mois - 1, jour);
  if (d.getDate() !== jour || d.getMonth() !== mois - 1) return '❌ Date invalide.';
  if (annee < 1900 || annee > new Date().getFullYear()) return '❌ Année invalide.';
  const txt = String(jour).padStart(2, '0') + '/' + String(mois).padStart(2, '0') + '/' + annee;
  if (!await db.setAnniversaire(user.id, txt)) {
    await db.upsertMember(user); // membre pas encore en base
    await db.setAnniversaire(user.id, txt);
  }
  return null;
}

async function handleButton(interaction) {
  await interaction.showModal(new ModalBuilder().setCustomId('anniv_modal').setTitle('Ton anniversaire').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Date de naissance (JJ/MM/AAAA)')
      .setPlaceholder('20/11/1988').setStyle(TextInputStyle.Short).setMinLength(8).setMaxLength(10).setRequired(true))));
}

async function handleModal(interaction) {
  const date = interaction.fields.getTextInputValue('date');
  const erreur = await enregistrer(interaction.user, date);
  if (erreur) return interaction.reply({ content: erreur, flags: 64 });
  await interaction.reply({ content: '🎂 Anniversaire enregistré ! Tu auras un message le jour J.', flags: 64 });
  await updateBirthdayChannel(interaction.client).catch(err => console.error('⚠️ Rafraîchissement liste anniversaires :', err.message));
}

module.exports = { startBirthdayTasks, updateBirthdayChannel, sendBirthdayMessages, enregistrer, handleButton, handleModal };