const fs = require('fs');
const {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');
const { visiblePar, cacherAuxAutres } = require('./temptext');

// Catégorie « 🎮 JEUX DIVERS » : le salon « à quoi tu joues ? » porte un bouton, le joueur donne le nom de son jeu
// et un lien obligatoire (Steam ou site web), ce qui crée un salon textuel pour ce jeu.
const STORE_PATH = dataPath('jeux.json');
const CAT_NOM    = '🎮 JEUX DIVERS';
const HUB_NOM    = '❓・à-quoi-tu-joues';
const INACTIF_MS  = 15 * 24 * 3600 * 1000; // salon supprimé après 15 jours sans message
const SWEEP_MS    = 3600 * 1000;
const COOLDOWN_MS = 60_000; // un jeu par minute et par joueur (anti-spam de salons)

// { categoryId, hubId, panelMsgId, jeux: { nomDuSalon: channelId } }
let store = { categoryId: null, hubId: null, panelMsgId: null, jeux: {} };
const derniere = new Map();
let sweep = null;

try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const slug = nom => '🎮-' + nom.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90);

function lienValide(txt) {
  try { const u = new URL(txt.trim()); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null; } catch { return null; }
}

function panelPayload() {
  return panneau({
    embeds: [{
      title: '🎮  À QUOI TU JOUES ? · WHAT ARE YOU PLAYING?',
      description: [
        'Tu joues à un jeu qui n\'a pas encore son salon ? Clique sur le bouton, donne **le nom du jeu** et un **lien Steam ou site web** (obligatoire) : un salon textuel est créé pour en parler.',
        'Playing a game with no channel yet? Click the button, enter **the game name** and a **Steam or website link** (required): a text channel is created to talk about it.',
      ].join('\n'),
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('jeux_new').setLabel('🎮 Ajouter mon jeu').setStyle(ButtonStyle.Success),
    )],
  });
}

// Retrouve (ou crée) la catégorie et le salon du bouton, puis republie le panneau (un seul, en bas).
async function startJeux(client) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
    if (!guild) return;
    const moi = client.user.id;
    const cat = guild.channels.cache.get(store.categoryId)
      || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CAT_NOM)
      || await guild.channels.create({
        name: CAT_NOM, type: ChannelType.GuildCategory, reason: 'Catégorie des jeux',
        permissionOverwrites: [{ id: visiblePar(guild), allow: [PermissionFlagsBits.ViewChannel] }, ...cacherAuxAutres(guild),
          { id: moi, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] }],
      });
    const hub = guild.channels.cache.get(store.hubId)
      || guild.channels.cache.find(c => c.parentId === cat.id && c.name === HUB_NOM)
      || await guild.channels.create({
        name: HUB_NOM, type: ChannelType.GuildText, parent: cat.id, position: 0, reason: 'Salon du bouton jeux',
        permissionOverwrites: [
          { id: visiblePar(guild), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          ...cacherAuxAutres(guild),
          { id: moi, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks] },
        ],
      });
    Object.assign(store, { categoryId: cat.id, hubId: hub.id });
    const ancien = store.panelMsgId && await hub.messages.fetch(store.panelMsgId).catch(() => null);
    if (ancien) await ancien.delete().catch(() => {});
    store.panelMsgId = (await hub.send(panelPayload())).id;
    save();
    await nettoyer(client);
    if (!sweep) sweep = setInterval(() => nettoyer(client).catch(() => {}), SWEEP_MS);
    console.log('🎮 Jeux · prêt (#' + hub.name + ')');
  } catch (err) {
    console.error('⚠️ Jeux :', err.message);
  }
}

// L'ID d'un message contient sa date (snowflake Discord)
const dernierMessage = channel => Number(BigInt(channel.lastMessageId || channel.id) >> 22n) + 1420070400000;

// Supprime les salons de jeu sans message depuis 15 jours (la carte du bot à la création compte comme premier message).
async function nettoyer(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
  if (!guild) return;
  for (const [nom, id] of Object.entries(store.jeux)) {
    const channel = guild.channels.cache.get(id);
    const perime = channel && Date.now() - dernierMessage(channel) > INACTIF_MS;
    if (perime) await channel.delete('Salon de jeu inactif depuis 15 jours').catch(() => {});
    if (!channel || perime) delete store.jeux[nom];
  }
  save();
}

async function handleButton(interaction) {
  const modal = new ModalBuilder().setCustomId('jeux_modal').setTitle('Ajouter mon jeu · Add my game');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom du jeu · Game name')
      .setStyle(TextInputStyle.Short).setMaxLength(60).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lien').setLabel('Lien Steam ou site web · Steam / web link')
      .setStyle(TextInputStyle.Short).setPlaceholder('https://store.steampowered.com/app/...').setMaxLength(300).setRequired(true)),
  );
  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const nom = interaction.fields.getTextInputValue('nom').trim();
  const lien = lienValide(interaction.fields.getTextInputValue('lien'));
  const reponse = content => interaction.reply({ content, flags: 64 });
  if (!lien) return reponse('❌ Lien invalide : il faut une adresse complète (https://…) vers Steam ou un site web. · Invalid link: a full https://… address is required.');
  const nomSalon = slug(nom);
  if (nomSalon === '🎮-') return reponse('❌ Nom de jeu invalide. · Invalid game name.');

  const guild = interaction.guild;
  const existant = guild.channels.cache.get(store.jeux[nomSalon]) || guild.channels.cache.find(c => c.parentId === store.categoryId && c.name === nomSalon);
  if (existant) return reponse('ℹ️ Ce jeu a déjà son salon : <#' + existant.id + '> · This game already has a channel.');

  const attente = COOLDOWN_MS - (Date.now() - (derniere.get(interaction.user.id) || 0));
  if (attente > 0) return reponse('⏳ Patiente ' + Math.ceil(attente / 1000) + ' s avant d\'ajouter un autre jeu. · Please wait.');
  derniere.set(interaction.user.id, Date.now());

  await interaction.deferReply({ flags: 64 });
  let channel;
  try {
    channel = await guild.channels.create({
      name: nomSalon, type: ChannelType.GuildText, parent: store.categoryId, topic: nom + ' · ' + lien,
      reason: 'Salon de jeu · ' + interaction.user.tag,
    });
  } catch (err) {
    return interaction.editReply('⚠️ Impossible de créer le salon (catégorie pleine ou permission manquante). · Could not create the channel.');
  }
  store.jeux[nomSalon] = channel.id;
  save();
  await channel.send({
    ...panneau({ embeds: [{
      title: '🎮 ' + nom.toUpperCase(),
      description: '🔗 **Lien · Link :** ' + lien + '\n\nProposé par · Added by <@' + interaction.user.id + '>\n⏳ Supprimé après **15 jours sans message** · Deleted after **15 days without messages**',
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }] }),
    allowedMentions: { users: [] },
  }).catch(() => {});
  await interaction.editReply('✅ Salon créé : <#' + channel.id + '>');
}

module.exports = { startJeux, handleButton, handleModal };
