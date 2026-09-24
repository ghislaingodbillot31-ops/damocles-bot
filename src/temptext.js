const fs = require('fs');
const {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

// Salons textuels temporaires, dans la catégorie TEXTUEL.
// Création par le bouton du salon d'accueil (lui aussi dans TEXTUEL, séparé des
// salons vocaux), gestion par le panneau posté dans chaque salon, invitations par /invite.
const TEXT_CATEGORY = '1552693042161385532';
const STORE_PATH    = dataPath('temptext.json');
const ACCUEIL_NOM   = '➕-créer-un-salon';
let accueilId = null; // salon d'accueil (mémorisé : il peut être renommé)
const INACTIF_MS    = 24 * 60 * 60 * 1000; // supprimé après 24 h sans message
const SWEEP_MS      = 10 * 60 * 1000;

// channelId -> { ownerId, createdAt, prive, invites: [userId], panelMsgId }
const salons = new Map();

const VOIR = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions];

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    for (const [id, v] of Object.entries(raw.channels || {})) salons.set(id, v);
    accueilId = raw.accueilId || null;
  } catch {}
}
function save() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify({ accueilId, channels: Object.fromEntries(salons) }, null, 2), 'utf-8'); } catch {}
}

// ── Salon d'accueil avec le bouton de création ────────────────────────────────
// Retrouve le salon mémorisé, sinon un salon de TEXTUEL non temporaire portant le
// nom d'accueil, sinon le crée (lecture seule pour les joueurs, seul le bot écrit).
async function salonAccueil(guild) {
  const connu = accueilId && guild.channels.cache.get(accueilId);
  if (connu) return connu;
  const existant = guild.channels.cache.find(c => c.parentId === TEXT_CATEGORY && c.type === ChannelType.GuildText
    && !salons.has(c.id) && c.name === ACCUEIL_NOM);
  const salon = existant || await guild.channels.create({
    name: ACCUEIL_NOM,
    type: ChannelType.GuildText,
    parent: TEXT_CATEGORY,
    position: 0,
    permissionOverwrites: [
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks] },
    ],
    reason: 'Salon d\'accueil des salons textuels temporaires',
  });
  accueilId = salon.id;
  save();
  return salon;
}

async function postTextPanel(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    for (const [, m] of msgs) if (m.author.id === channel.client.user.id) await m.delete().catch(() => {});
  } catch {}

  await channel.send(panneau({
    embeds: [{
      title: '💬  SALONS TEXTUELS TEMPORAIRES',
      description: [
        'Clique sur le bouton pour créer **ton propre salon textuel**.',
        '',
        '> • Tu choisis son **nom** à la création.',
        '> • Tu peux le rendre **privé** et y inviter des joueurs avec **/invite** `joueur`.',
        '> • Il est **supprimé automatiquement** après 24 h sans message.',
      ].join('\n'),
      color: 0x5865F2,
      footer: { text: 'EUROAGRI · Damoclès Bot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('text_create').setLabel('💬 Créer mon salon textuel').setStyle(ButtonStyle.Success),
    )],
  })).catch(console.error);
}

function autoClean(interaction, delay = 5000) {
  setTimeout(() => interaction.deleteReply().catch(() => {}), delay);
}

function peutGerer(interaction, cid) {
  const info = salons.get(cid);
  return info && (info.ownerId === interaction.user.id
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild));
}

function nomSalon(nom) {
  return '💬-' + nom.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 90);
}

// ── Panneau de contrôle (message épinglé dans le salon) ──────────────────────
function controlRow(cid, prive) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('text_rename_' + cid).setLabel('✏️ Renommer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('text_lock_' + cid).setLabel(prive ? '🌐 Rendre public' : '🔒 Rendre privé').setStyle(prive ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('text_delete_' + cid).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
  );
}

function panelPayload(cid, info) {
  const invites = info.invites?.length ? info.invites.map(id => '<@' + id + '>').join(' · ') : 'Aucun';
  return {
    content: '<@' + info.ownerId + '>',
    ...panneau({ embeds: [{
      title: '💬 TON SALON TEXTUEL',
      description: [
        info.prive
          ? '🔒 **Privé** · seuls toi et tes invités le voient.'
          : '🌐 **Public** · tout le serveur peut le voir.',
        '',
        '> • **/invite** `joueur` dans ce salon pour inviter quelqu\'un.',
        '> • Il est **supprimé automatiquement après 24 h sans message**.',
        '',
        '👥 **Invités :** ' + invites,
      ].join('\n'),
      color: info.prive ? 0xE67E22 : 0x5865F2,
    }] }),
    components: [controlRow(cid, info.prive)],
    allowedMentions: { users: [info.ownerId] },
  };
}

async function majPanneau(channel, info) {
  const msg = info.panelMsgId && await channel.messages.fetch(info.panelMsgId).catch(() => null);
  if (msg) return msg.edit(panelPayload(channel.id, info)).catch(() => {});
  const nouveau = await channel.send(panelPayload(channel.id, info)).catch(() => null);
  if (nouveau) { await nouveau.pin().catch(() => {}); info.panelMsgId = nouveau.id; salons.set(channel.id, info); save(); }
}

// ── Création ──────────────────────────────────────────────────────────────────
async function handleTextCreate(interaction) {
  const deja = [...salons.entries()].find(([, v]) => v.ownerId === interaction.user.id)?.[0];
  if (deja && interaction.guild.channels.cache.get(deja)) {
    await interaction.reply({ content: '💬 Tu as déjà un salon textuel : <#' + deja + '>', flags: 64 });
    autoClean(interaction);
    return;
  }
  const modal = new ModalBuilder().setCustomId('text_create_modal').setTitle('Créer mon salon textuel');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('nom').setLabel('Nom du salon').setStyle(TextInputStyle.Short)
      .setValue(interaction.member.displayName.slice(0, 60)).setMaxLength(60).setRequired(true),
  ));
  await interaction.showModal(modal);
}

async function creerSalon(interaction, nom) {
  const guild = interaction.guild;
  const member = interaction.member;
  let channel;
  try {
    channel = await guild.channels.create({
      name: nomSalon(nom),
      type: ChannelType.GuildText,
      parent: TEXT_CATEGORY,
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [...VOIR, PermissionFlagsBits.ManageMessages] },
        { id: interaction.client.user.id, allow: [...VOIR, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles] },
      ],
      reason: 'Salon textuel temporaire · ' + member.user.tag,
    });
  } catch (err) {
    await interaction.reply({ content: '⚠️ Impossible de créer le salon (permission `Gérer les salons` manquante ?). ' + err.message, flags: 64 });
    autoClean(interaction);
    return;
  }

  const info = { ownerId: member.id, createdAt: Date.now(), prive: false, invites: [] };
  salons.set(channel.id, info);
  save();
  await majPanneau(channel, info);

  await interaction.reply({
    ...panneau({ embeds: [{ title: '💬 Ton salon est prêt', description: '<#' + channel.id + '>\n> Le panneau pour le gérer est épinglé dedans.', color: 0x2ECC71 }] }),
    flags: 64,
  });
  autoClean(interaction, 15000);
}

// ── Boutons de contrôle ───────────────────────────────────────────────────────
async function handleTextControl(interaction) {
  const id = interaction.customId;
  const cid = id.replace(/^text_(rename|lock|delete)_/, '');
  const channel = interaction.guild.channels.cache.get(cid);
  if (!channel || !salons.has(cid)) { await interaction.reply({ content: '❌ Ce salon n\'existe plus.', flags: 64 }); autoClean(interaction); return; }
  if (!peutGerer(interaction, cid)) { await interaction.reply({ content: '❌ Seul le créateur du salon peut faire ça.', flags: 64 }); autoClean(interaction); return; }
  const info = salons.get(cid);

  if (id.startsWith('text_rename_')) {
    const modal = new ModalBuilder().setCustomId('text_rename_modal_' + cid).setTitle('Renommer le salon');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short)
        .setValue(channel.name.replace(/^💬-/, '')).setMaxLength(60).setRequired(true),
    ));
    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('text_lock_')) {
    info.prive = !info.prive;
    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: info.prive ? false : true }).catch(() => {});
    salons.set(cid, info);
    save();
    await interaction.update(panelPayload(cid, info));
    return;
  }

  if (id.startsWith('text_delete_')) {
    salons.delete(cid);
    save();
    await interaction.update({ content: '', embeds: [{ description: '🗑️ Salon supprimé.', color: 0x95A5A6 }], components: [] }).catch(() => {});
    await channel.delete('Supprimé par le créateur').catch(() => {});
  }
}

// ── Modales ───────────────────────────────────────────────────────────────────
async function handleTextModal(interaction) {
  const nom = interaction.fields.getTextInputValue('nom').trim();
  if (!nom) { await interaction.reply({ content: '❌ Le nom est vide.', flags: 64 }); autoClean(interaction); return; }

  if (interaction.customId === 'text_create_modal') return creerSalon(interaction, nom);

  const cid = interaction.customId.replace('text_rename_modal_', '');
  const channel = interaction.guild.channels.cache.get(cid);
  if (!channel || !salons.has(cid)) { await interaction.reply({ content: '❌ Ce salon n\'existe plus.', flags: 64 }); autoClean(interaction); return; }
  if (!peutGerer(interaction, cid)) { await interaction.reply({ content: '❌ Seul le créateur peut faire ça.', flags: 64 }); autoClean(interaction); return; }
  await channel.setName(nomSalon(nom)).catch(() => {});
  await interaction.reply({ content: '✅ Salon renommé. (Discord limite les renommages à 2 toutes les 10 minutes.)', flags: 64 });
  autoClean(interaction);
}

// ── /invite ───────────────────────────────────────────────────────────────────
async function inviter(interaction, user) {
  const cid = interaction.channelId;
  if (!salons.has(cid)) {
    const mien = [...salons.entries()].find(([, v]) => v.ownerId === interaction.user.id)?.[0];
    await interaction.reply({ content: '❌ Utilise **/invite** dans ton salon textuel temporaire' + (mien ? ' : <#' + mien + '>' : '.'), flags: 64 });
    return;
  }
  if (!peutGerer(interaction, cid)) { await interaction.reply({ content: '❌ Seul le créateur du salon peut inviter.', flags: 64 }); return; }
  if (user.bot) { await interaction.reply({ content: '❌ Impossible d\'inviter un bot.', flags: 64 }); return; }

  const info = salons.get(cid);
  if (user.id === info.ownerId || info.invites.includes(user.id)) {
    await interaction.reply({ content: 'ℹ️ <@' + user.id + '> a déjà accès à ce salon.', flags: 64, allowedMentions: { users: [] } });
    return;
  }
  const membre = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!membre) { await interaction.reply({ content: '❌ Ce joueur n\'est pas sur le serveur.', flags: 64 }); return; }

  await interaction.channel.permissionOverwrites.edit(user.id, Object.fromEntries(
    ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'AddReactions'].map(p => [p, true]),
  ));
  info.invites.push(user.id);
  salons.set(cid, info);
  save();
  await majPanneau(interaction.channel, info);
  await interaction.reply({ content: '✅ <@' + user.id + '> est invité dans le salon.', allowedMentions: { users: [user.id] } });
}

// ── Nettoyage : 24 h sans message ─────────────────────────────────────────────
function dernierMessage(channel, info) {
  // L'ID d'un message contient sa date (snowflake Discord)
  const t = channel.lastMessageId ? Number(BigInt(channel.lastMessageId) >> 22n) + 1420070400000 : 0;
  return Math.max(t, info.createdAt || 0);
}

async function nettoyer(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;
  for (const [cid, info] of [...salons.entries()]) {
    const channel = guild.channels.cache.get(cid);
    if (!channel) { salons.delete(cid); save(); continue; }
    if (Date.now() - dernierMessage(channel, info) > INACTIF_MS) {
      salons.delete(cid);
      save();
      await channel.delete('Salon textuel temporaire inactif depuis 24 h').catch(() => {});
    }
  }
}

async function startTempText(client) {
  load();
  setInterval(() => nettoyer(client).catch(() => {}), SWEEP_MS);
  try {
    await nettoyer(client);
    const guild = client.guilds.cache.first();
    if (guild) await postTextPanel(await salonAccueil(guild));
    console.log('💬 Salons textuels temporaires — prêt (' + salons.size + ' actif(s))');
  } catch (err) {
    console.error('⚠️ Salons textuels temporaires :', err.message);
  }
}

module.exports = { TEXT_CATEGORY, startTempText, handleTextCreate, handleTextControl, handleTextModal, inviter };
