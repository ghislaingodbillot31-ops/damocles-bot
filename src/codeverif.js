// Deux modes de vérification par code :
const { panneau } = require('./embed-format');
//
// • VERIF_MODE=code (Le Coin des Copains) : le nouvel arrivant reçoit un code dans le salon de vérification, le retape et obtient
//   le rôle Membres. Aucune expulsion.
//
// • VERIF_MODE=code-compte : le compte est d'abord vérifié dans bot-status (verification.verifyMember).
//   Une fois validé, un salon PRIVÉ « code-<pseudo> » s'ouvre (visible du seul joueur et du staff) et le code lui est envoyé
//   en MP (à défaut dans ce salon privé). Le bon code donne le rôle « En attente » (accès au règlement) et supprime le salon ;
//   l'acceptation du règlement donne ensuite l'accès à tout. Il n'est jamais nécessaire de parler pour activer son compte.
const crypto = require('crypto');
const fs = require('fs');
const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const db = require('./database');
const { log } = require('./logger');
const { dataPath } = require('./paths');

// Salon où se tape le code : VERIFICATION_CHANNEL_ID
const codeChannel = guild => guild.channels.cache.get(process.env.VERIFICATION_CHANNEL_ID);
const FLOW = () => process.env.VERIF_MODE === 'code-compte';
const MAX_ESSAIS = 5;
const newCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const flash = async (channel, text, ms = 6000) => {
  const m = await channel.send(text).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), ms);
};

// ── code-compte : état persistant { userId: { code, channelId, essais } } ────────
const STORE_PATH = dataPath('codeverif.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const slug = member => 'code-' + (String(member.user.username).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || member.id);

// Salon privé du joueur (réutilisé s'il existe déjà)
async function salonPrive(member) {
  const g = member.guild;
  const ancien = store[member.id]?.channelId && (g.channels.cache.get(store[member.id].channelId) || await g.channels.fetch(store[member.id].channelId).catch(() => null));
  if (ancien) return ancien;
  const parent = g.channels.cache.get(process.env.CODE_CATEGORY_ID)?.id || codeChannel(g)?.parentId || null;
  const voir = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages];
  const overwrites = [
    { id: g.id, deny: [P.ViewChannel] },
    { id: member.id, allow: voir },
    { id: g.client.user.id, allow: [...voir, P.ManageChannels, P.ManageMessages] },
  ];
  for (const r of g.roles.cache.filter(r => !r.managed && (r.permissions.has(P.Administrator) || /mod[eé]rat/i.test(r.name))).values()) {
    overwrites.push({ id: r.id, allow: voir });
  }
  return g.channels.create({
    name: slug(member), type: ChannelType.GuildText, parent, permissionOverwrites: overwrites,
    topic: 'Code de validation de ' + member.user.tag, reason: 'Vérification par code : ' + member.user.tag,
  }).catch(err => { console.error('⚠️ codeverif : salon privé impossible :', err.message); return null; });
}

// Génère un code, l'envoie en MP (sinon dans le salon privé) et le mémorise
async function issueFlow(member) {
  const channel = await salonPrive(member);
  if (!channel) return null;
  const code = newCode();
  store[member.id] = { code, channelId: channel.id, essais: 0 };
  save();

  const embedCode = {
    title: '🔐 Ton code de validation',
    description: 'Voici ton code pour activer ton compte sur **' + member.guild.name + '** :\n# `' + code + '`\nTape-le dans <#' + channel.id + '>.',
    color: 0x3498DB,
  };
  let mp = true;
  await member.send(panneau({ embeds: [embedCode] })).catch(() => { mp = false; });
  await channel.send(panneau({
    content: '<@' + member.id + '>',
    embeds: [{
      title: '🔐 Code de validation',
      description: [
        'Bienvenue sur **' + member.guild.name + '** ! Ton compte est vérifié, il reste à l\'activer.',
        mp ? '📩 Ton **code** t\'a été envoyé en **message privé**. Tape-le ici pour continuer.'
           : '⚠️ Tes MP sont fermés : voici ton code (visible de toi seul) :\n# `' + code + '`\nTape-le ici pour continuer.',
      ].join('\n'),
      color: 0x3498DB,
    }],
  })).catch(() => {});
  return channel;
}

async function onMessageFlow(message) {
  const entree = Object.entries(store).find(([, v]) => v.channelId === message.channelId);
  if (!entree) return false;
  const [userId, e] = entree;
  if (message.author.id !== userId) return false; // le staff peut parler dans le salon
  message.delete().catch(() => {});
  const member = message.member;
  if (!member) return true;

  if (message.content.trim().toUpperCase() === e.code) {
    if (process.env.ATTENTE_ROLE_ID) await member.roles.add(process.env.ATTENTE_ROLE_ID).catch(() => {});
    // (sur Le Coin des Copains le rôle « En attente » est le rôle Vérification lui-même : on ne le retire pas)
    if (process.env.VERIFICATION_ROLE_ID && process.env.VERIFICATION_ROLE_ID !== process.env.ATTENTE_ROLE_ID) await member.roles.remove(process.env.VERIFICATION_ROLE_ID).catch(() => {});
    await db.upsertMember(member.user, { verifiedAt: new Date().toISOString(), verificationResult: 'ok', codeValidatedAt: new Date().toISOString() });
    delete store[userId]; save();
    await message.channel.send(panneau({ content: '<@' + userId + '>', embeds: [{
      description: '✅ **Compte activé !** Lis et accepte le **règlement** (<#' + process.env.REGLEMENT_CHANNEL_ID + '>) pour accéder au serveur.\nCe salon va se fermer.',
      color: 0x2ECC71,
    }] })).catch(() => {});
    await log(message.client, 'verification_ok', { userId });
    setTimeout(() => message.channel.delete('Code validé').catch(() => {}), 8000);
    return true;
  }

  e.essais++;
  if (e.essais >= MAX_ESSAIS) {
    await flash(message.channel, '❌ Trop d\'essais : un **nouveau code** vient de t\'être envoyé.', 10000);
    await issueFlow(member);
  } else {
    save();
    await flash(message.channel, '❌ Code incorrect (' + e.essais + '/' + MAX_ESSAIS + '), réessaie.');
  }
  return true;
}

// Le joueur est parti : on supprime son salon et son code
async function cleanup(member) {
  const e = store[member.id];
  if (!e) return;
  delete store[member.id]; save();
  (member.guild.channels.cache.get(e.channelId) || await member.guild.channels.fetch(e.channelId).catch(() => null))?.delete('Joueur parti').catch(() => {});
}

// ── mode « code » (Le Coin des Copains) : tout est privé ──────────────────────────────────
// Le salon ne contient qu'un panneau avec deux boutons : « Obtenir mon code » (code affiché à toi seul) et
// « Entrer mon code » (formulaire). Rien n'est tapé ni affiché publiquement.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const codes = new Map(); // userId → code  (perdu au redémarrage : un nouveau code est alors redonné)
const membreRole = () => process.env.MEMBRE_ROLE_ID || process.env.ACTIVE_ROLE_ID; // Membres (Le Coin des Copains) ou Membre vérifié

function panelPayload(nomServeur) {
  return {
    content: '',
    ...panneau({ embeds: [{
      title: '🔐 VÉRIFICATION · VERIFICATION',
      description: [
        '🇫🇷 Bienvenue sur **' + nomServeur + '** ! Clique sur **Obtenir mon code**, puis sur **Entrer mon code** pour accéder au serveur.',
        '🇬🇧 Welcome to **' + nomServeur + '**! Click **Get my code**, then **Enter my code** to get access.',
        '',
        '🔒 Ton code et ta saisie restent privés : personne d\'autre ne les voit.',
        '🔒 Your code and your entry stay private: nobody else can see them.',
      ].join('\n'),
      color: 0x3498DB,
      footer: { text: 'MonCopainBot' },
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verif_code').setLabel('🔑 Obtenir mon code · Get my code').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('verif_saisir').setLabel('⌨️ Entrer mon code · Enter my code').setStyle(ButtonStyle.Success),
    )],
  };
}

// Un seul panneau dans le salon : mis à jour s'il existe, sinon posté (les anciens messages du bot sont retirés)
async function publierPanneau(client) {
  const id = process.env.VERIFICATION_CHANNEL_ID;
  const channel = id && (client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null));
  if (!channel) return;
  const payload = panelPayload(channel.guild.name);
  const existant = [...(await channel.messages.fetch({ limit: 50 }).catch(() => new Map())).values()]
    .find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(b => b.customId === 'verif_code')));
  if (existant) await existant.edit(payload).catch(() => {});
  else await channel.send(payload).catch(() => {});
  await require('./nettoyage').epurer(client, id, true); // strict : les anciens codes affichés en public partent aussi
}

// Arrivée d'un membre : rien n'est écrit dans le salon, le panneau suffit
const issueSimple = member => publierPanneau(member.client);

// Salon de vérification : les messages écrits (code ou autre) sont supprimés, ils pourraient exposer un code
async function onMessageSimple(message) {
  if (message.channel.id !== process.env.VERIFICATION_CHANNEL_ID) return false;
  const { member } = message;
  if (member?.roles.cache.has(membreRole()) || member?.permissions.has('ManageMessages')) return false;
  message.delete().catch(() => {});
  await flash(message.channel, '🔒 <@' + message.author.id + '> utilise les boutons ci-dessus, n\'écris pas ton code ici. · Use the buttons above, do not type your code here.', 8000);
  return true;
}

// Boutons du panneau : réponses visibles par le joueur seul
async function handleButton(interaction) {
  const member = interaction.member;
  if (member.roles.cache.has(membreRole())) return interaction.reply({ content: 'Tu es déjà vérifié. You are already verified.', flags: 64 });
  if (interaction.customId === 'verif_code') {
    if (!codes.has(member.id)) codes.set(member.id, newCode());
    return interaction.reply({ content: 'Ton code : ' + codes.get(member.id) + '\nClique sur Entrer mon code pour le saisir. Your code is above, click Enter my code.', flags: 64 });
  }
  if (!codes.has(member.id)) return interaction.reply({ content: 'Clique d\'abord sur Obtenir mon code. Click Get my code first.', flags: 64 });
  return interaction.showModal(new ModalBuilder().setCustomId('verif_modal').setTitle('Vérification · Verification').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('Ton code · Your code')
      .setStyle(TextInputStyle.Short).setMinLength(6).setMaxLength(6).setRequired(true))));
}

async function handleModal(interaction) {
  const member = interaction.member;
  const saisi = interaction.fields.getTextInputValue('code').trim().toUpperCase();
  if (!codes.has(member.id) || saisi !== codes.get(member.id)) {
    return interaction.reply({ content: 'Code incorrect, réessaie. Wrong code, try again.', flags: 64 });
  }
  await member.roles.add(membreRole()).catch(() => {});
  if (process.env.VERIFICATION_ROLE_ID) await member.roles.remove(process.env.VERIFICATION_ROLE_ID).catch(() => {});
  await db.upsertMember(member.user, { verifiedAt: new Date().toISOString(), verificationResult: 'ok' });
  codes.delete(member.id);
  await interaction.reply({ content: 'Vérifié, bienvenue ! Verified, welcome!', flags: 64 });
}

// true = message traité (salon de vérification / de code), l'appelant s'arrête là
const onMessage = message => FLOW() ? onMessageFlow(message) : onMessageSimple(message);
const issue = member => FLOW() ? issueFlow(member) : issueSimple(member);

module.exports = { issue, onMessage, cleanup, publierPanneau, handleButton, handleModal };
