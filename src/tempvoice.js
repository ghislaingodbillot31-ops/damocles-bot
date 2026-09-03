const fs   = require('fs');
const path = require('path');
const {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

// ── Config ────────────────────────────────────────────────────────────────────
const PANEL_CHANNEL   = '1544898451706482728'; // salon texte où se trouve le bouton
const VOICE_CATEGORY  = '1345486205810118806'; // catégorie des salons vocaux temporaires
const STORE_PATH      = path.join(__dirname, '..', 'data', 'tempvoice.json');
const SWEEP_MS        = 60_000; // vérification des salons vides
const GRACE_MS        = 90_000; // délai avant de supprimer un salon jamais rejoint

// channelId -> { ownerId, createdAt, locked }
const salons = new Map();

// ── Persistance ───────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    for (const [id, v] of Object.entries(raw.channels || {})) salons.set(id, v);
  } catch {}
}
function save() {
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ channels: Object.fromEntries(salons) }, null, 2), 'utf-8');
  } catch {}
}

// ── Panneau avec le bouton ────────────────────────────────────────────────────
async function postVoicePanel(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    for (const [, m] of msgs) if (m.author.id === channel.client.user.id) await m.delete().catch(() => {});
  } catch {}

  await channel.send({
    embeds: [{
      title: '🔊  SALONS VOCAUX TEMPORAIRES',
      description: [
        'Clique sur le bouton pour créer **ton propre salon vocal**.',
        '',
        '> • Tu es déplacé dedans automatiquement si tu es déjà en vocal.',
        '> • Tu peux le **renommer**, définir une **limite**, le **verrouiller**.',
        '> • Il est **supprimé automatiquement** dès qu\'il est vide.',
      ].join('\n'),
      color: 0x5865F2,
      footer: { text: 'EURO-AGRI — Damoclès Bot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voice_create').setLabel('➕ Créer mon salon vocal').setStyle(ButtonStyle.Success),
    )],
  }).catch(console.error);
}

// ── Bouton « Créer mon salon vocal » ──────────────────────────────────────────
async function handleVoiceCreate(interaction) {
  const guild  = interaction.guild;
  const member = interaction.member;

  // Déjà propriétaire d'un salon encore vivant ?
  const dejaId = [...salons.entries()].find(([, v]) => v.ownerId === member.id)?.[0];
  if (dejaId && guild.channels.cache.get(dejaId)) {
    await interaction.reply({ content: '🔊 Tu as déjà un salon : <#' + dejaId + '>', flags: 64 });
    autoClean(interaction);
    return;
  }

  let voice;
  try {
    voice = await guild.channels.create({
      name: '🔊 ' + member.displayName.slice(0, 90),
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY,
      permissionOverwrites: [
        { id: guild.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        { id: member.id,  allow: [
          PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect,
          PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers,
        ] },
      ],
      reason: 'Salon vocal temporaire — ' + member.user.tag,
    });
  } catch (err) {
    await interaction.reply({ content: '⚠️ Impossible de créer le salon (permission `Gérer les salons` manquante ?). ' + err.message, flags: 64 });
    autoClean(interaction);
    return;
  }

  salons.set(voice.id, { ownerId: member.id, createdAt: Date.now(), locked: false });
  save();

  // Déplacer le membre s'il est déjà en vocal
  let deplace = false;
  if (member.voice?.channelId) {
    await member.voice.setChannel(voice).then(() => { deplace = true; }).catch(() => {});
  }

  await interaction.reply({
    embeds: [{
      title: '🔊 Ton salon est prêt',
      description: '<#' + voice.id + '>' + (deplace ? '\n> Tu y as été déplacé.' : '\n> Rejoins-le quand tu veux !'),
      color: 0x2ECC71,
    }],
    components: [controlRow(voice.id, false)],
    flags: 64,
  });
  autoClean(interaction, 120000);
}

function controlRow(channelId, locked) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('voice_rename_' + channelId).setLabel('✏️ Renommer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice_limit_' + channelId).setLabel('👥 Limite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice_lock_' + channelId).setLabel(locked ? '🔓 Déverrouiller' : '🔒 Verrouiller').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice_delete_' + channelId).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
  );
}

function autoClean(interaction, delay = 5000) {
  setTimeout(() => interaction.deleteReply().catch(() => {}), delay);
}

// Vérifie que l'utilisateur peut piloter ce salon
function peutGerer(interaction, channelId) {
  const info = salons.get(channelId);
  return info && (info.ownerId === interaction.user.id
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild));
}

// ── Boutons de contrôle ───────────────────────────────────────────────────────
async function handleVoiceControl(interaction) {
  const id  = interaction.customId;
  const cid = id.replace(/^voice_(rename|limit|lock|delete)_/, '');
  const channel = interaction.guild.channels.cache.get(cid);

  if (!channel || !salons.has(cid)) {
    await interaction.reply({ content: '❌ Ce salon n\'existe plus.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if (!peutGerer(interaction, cid)) {
    await interaction.reply({ content: '❌ Seul le créateur du salon peut faire ça.', flags: 64 });
    autoClean(interaction);
    return;
  }

  if (id.startsWith('voice_rename_')) {
    const modal = new ModalBuilder().setCustomId('voice_rename_modal_' + cid).setTitle('Renommer le salon');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short)
        .setValue(channel.name.replace(/^🔊 /, '')).setMaxLength(90).setRequired(true),
    ));
    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('voice_limit_')) {
    const modal = new ModalBuilder().setCustomId('voice_limit_modal_' + cid).setTitle('Limite de places');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('limite').setLabel('Nombre de places (0 = illimité)').setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5').setValue(String(channel.userLimit || 0)).setRequired(true),
    ));
    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('voice_lock_')) {
    const info    = salons.get(cid);
    const lock    = !info.locked;
    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: lock ? false : null }).catch(() => {});
    info.locked = lock;
    salons.set(cid, info);
    save();
    await interaction.update({
      embeds: [{ title: '🔊 Ton salon', description: '<#' + cid + '>\n> ' + (lock ? '🔒 **Verrouillé** — personne ne peut plus rejoindre.' : '🔓 **Déverrouillé**.'), color: lock ? 0xE67E22 : 0x2ECC71 }],
      components: [controlRow(cid, lock)],
    });
    return;
  }

  if (id.startsWith('voice_delete_')) {
    salons.delete(cid);
    save();
    await channel.delete('Supprimé par le créateur').catch(() => {});
    await interaction.update({ embeds: [{ description: '🗑️ Salon supprimé.', color: 0x95A5A6 }], components: [] });
    autoClean(interaction);
    return;
  }
}

// ── Modales ───────────────────────────────────────────────────────────────────
async function handleVoiceModal(interaction) {
  const cid = interaction.customId.replace(/^voice_(rename|limit)_modal_/, '');
  const channel = interaction.guild.channels.cache.get(cid);
  if (!channel || !salons.has(cid)) { await interaction.reply({ content: '❌ Ce salon n\'existe plus.', flags: 64 }); autoClean(interaction); return; }
  if (!peutGerer(interaction, cid)) { await interaction.reply({ content: '❌ Seul le créateur peut faire ça.', flags: 64 }); autoClean(interaction); return; }

  if (interaction.customId.startsWith('voice_rename_modal_')) {
    const nom = interaction.fields.getTextInputValue('nom').trim().slice(0, 90);
    await channel.setName('🔊 ' + nom).catch(() => {});
    await interaction.reply({ content: '✅ Salon renommé.', flags: 64 });
    autoClean(interaction);
    return;
  }

  if (interaction.customId.startsWith('voice_limit_modal_')) {
    let n = parseInt(interaction.fields.getTextInputValue('limite').trim(), 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 99) n = 99;
    await channel.setUserLimit(n).catch(() => {});
    await interaction.reply({ content: n === 0 ? '✅ Salon en illimité.' : '✅ Limite fixée à ' + n + ' place(s).', flags: 64 });
    autoClean(interaction);
    return;
  }
}

// ── Suppression des salons vides ──────────────────────────────────────────────
async function nettoyer(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  for (const [cid, info] of [...salons.entries()]) {
    const channel = guild.channels.cache.get(cid);
    if (!channel) { salons.delete(cid); save(); continue; }
    const vide      = channel.members.size === 0;
    const depuisAssezLongtemps = Date.now() - (info.createdAt || 0) > GRACE_MS;
    if (vide && depuisAssezLongtemps) {
      salons.delete(cid);
      save();
      await channel.delete('Salon vocal temporaire vide').catch(() => {});
    }
  }

  // Salons orphelins dans la catégorie (créés par le bot, non suivis, vides)
  try {
    const cat = guild.channels.cache.get(VOICE_CATEGORY);
    const enfants = guild.channels.cache.filter(c => c.parentId === VOICE_CATEGORY && c.type === ChannelType.GuildVoice);
    for (const [, c] of enfants) {
      if (!salons.has(c.id) && c.members.size === 0) await c.delete('Salon vocal temporaire orphelin').catch(() => {});
    }
  } catch {}
}

// ── VoiceStateUpdate → supprimer dès que vide ─────────────────────────────────
async function handleVoiceState(oldState) {
  const cid = oldState.channelId;
  if (!cid || !salons.has(cid)) return;
  const channel = oldState.guild.channels.cache.get(cid);
  if (channel && channel.members.size === 0) {
    salons.delete(cid);
    save();
    await channel.delete('Salon vocal temporaire vide').catch(() => {});
  }
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startTempVoice(client) {
  load();
  try {
    await nettoyer(client);
    const panel = client.channels.cache.get(PANEL_CHANNEL)
      || await client.channels.fetch(PANEL_CHANNEL).catch(() => null);
    if (panel) await postVoicePanel(panel);
    console.log('🔊 Salons vocaux temporaires — prêt');
  } catch (err) {
    console.error('⚠️ Temp voice :', err.message);
  }
  setInterval(() => nettoyer(client).catch(() => {}), SWEEP_MS);
}

module.exports = {
  PANEL_CHANNEL, VOICE_CATEGORY,
  startTempVoice, postVoicePanel,
  handleVoiceCreate, handleVoiceControl, handleVoiceModal, handleVoiceState,
};
