const { publier } = require('./panneau-sync');
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
const HUB_NOM    = '🎮・partage-tes-jeux';
const WISH_NOM   = '⭐・wishlist';
const INACTIF_MS  = 15 * 24 * 3600 * 1000; // salon supprimé après 15 jours sans message
const SWEEP_MS    = 3600 * 1000;
const COOLDOWN_MS = 60_000; // un jeu par minute et par joueur (anti-spam de salons)

// { categoryId, hubId, panelMsgId, wishId, jeux: { nomDuSalon: channelId }, wish: { msgId: { nom, lien, date, auteur, y: [ids], n: [ids] } } }
let store = { categoryId: null, hubId: null, panelMsgId: null, wishId: null, jeux: {}, wish: {} };
const derniere = new Map();
let sweep = null;

try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const slug = nom => '🎮-' + nom.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90);

function lienValide(txt) {
  try { const u = new URL(txt.trim()); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null; } catch { return null; }
}

// Lien Steam (store.steampowered.com/app/<id>/…) → image d'en-tête du jeu ; autre lien → pas d'image
function imageSteam(lien) {
  const id = /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/.exec(lien || '')?.[1];
  return id ? { url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + id + '/header.jpg' } : undefined;
}

const steamId = lien => /store\.steampowered\.com\/app\/(\d+)/.exec(lien || '')?.[1];

// Refuse un jeu déjà présent (salon de jeu ou wishlist), reconnu par son nom (insensible à la casse/ponctuation)
// ou par son identifiant Steam. Renvoie le message de refus, ou null si le jeu est nouveau.
function doublon(guild, nom, lien) {
  const cle = slug(nom), id = steamId(lien);
  for (const [k, chId] of Object.entries(store.jeux)) {
    const ch = guild.channels.cache.get(chId);
    if (ch && (k === cle || (id && steamId(ch.topic) === id)))
      return '⛔ Ce jeu existe déjà dans les jeux : <#' + ch.id + '>. Rejoins ce salon pour en parler ! · This game already exists in the games list.';
  }
  for (const [msgId, w] of Object.entries(store.wish)) {
    if (slug(w.nom) === cle || (id && steamId(w.lien) === id))
      return '⛔ Ce jeu est déjà dans la wishlist : https://discord.com/channels/' + guild.id + '/' + store.wishId + '/' + msgId + ' — vote 👍 ou 👎 dessus ! · This game is already in the wishlist.';
  }
  return null;
}

function panelPayload() {
  return panneau({
    embeds: [{
      title: '🎮  PARTAGE TES JEUX · SHARE YOUR GAMES',
      description: [
        'Tu joues à un jeu qui n\'a pas encore son salon ? Clique sur le bouton, donne **le nom du jeu** et un **lien Steam ou site web** (obligatoire) : un salon textuel est créé pour en parler.',
        'Playing a game with no channel yet? Click the button, enter **the game name** and a **Steam or website link** (required): a text channel is created to talk about it.',
        '⭐ **Wishlist** : propose un jeu pas encore sorti, les autres votent. · Suggest an unreleased game, others vote.',
      ].join('\n'),
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('jeux_new').setLabel('🎮 Ajouter mon jeu').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('jeux_wish').setLabel('⭐ Wishlist').setStyle(ButtonStyle.Primary),
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
    const wish = guild.channels.cache.get(store.wishId)
      || guild.channels.cache.find(c => c.parentId === cat.id && c.name === WISH_NOM)
      || await guild.channels.create({
        name: WISH_NOM, type: ChannelType.GuildText, parent: cat.id, reason: 'Salon wishlist',
        permissionOverwrites: [
          { id: visiblePar(guild), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          ...cacherAuxAutres(guild),
          { id: moi, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
      });
    if (hub.name !== HUB_NOM) await hub.setName(HUB_NOM, 'Renommage du salon').catch(() => {});
    Object.assign(store, { categoryId: cat.id, hubId: hub.id, wishId: wish.id });
    // Actualisation sans notification : on édite le panneau existant ; sinon on repart propre et on en republie un seul
    store.panelMsgId = (await publier(hub, store.panelMsgId, panelPayload(), async () => {
      const anciens = await hub.messages.fetch({ limit: 50 }).catch(() => null);
      for (const m of anciens?.filter(m => m.author.id === moi).values() || []) await m.delete().catch(() => {});
    }, 'Partage tes jeux')).id;
    save();
    await ajouterImages(guild);
    await nettoyer(client);
    if (!sweep) sweep = setInterval(() => nettoyer(client).catch(() => {}), SWEEP_MS);
    console.log('🎮 Jeux · prêt (#' + hub.name + ')');
  } catch (err) {
    console.error('⚠️ Jeux :', err.message);
  }
}

// Ajoute l'image Steam aux cartes déjà publiées (salons de jeu : lien lu dans le sujet « nom · lien » ; wishlist : lien enregistré).
// Idempotent : une carte qui a déjà son image n'est pas touchée. Les modifications ne notifient pas.
async function ajouterImages(guild) {
  let n = 0;
  for (const chId of Object.values(store.jeux)) {
    const ch = guild.channels.cache.get(chId);
    const image = imageSteam(ch?.topic);
    if (!image) continue;
    const msgs = await ch.messages.fetch({ limit: 50 }).catch(() => null);
    const carte = msgs?.find(m => m.author.id === guild.client.user.id && m.embeds[0]?.title?.startsWith('🎮 ') && !m.embeds[0].image);
    if (carte && await carte.edit({ embeds: [{ ...carte.embeds[0].toJSON(), image }] }).then(() => true, () => false)) n++;
  }
  const wl = guild.channels.cache.get(store.wishId);
  for (const [msgId, w] of Object.entries(store.wish)) {
    if (!imageSteam(w.lien)) continue;
    const m = await wl?.messages.fetch(msgId).catch(() => null);
    if (m && !m.embeds[0]?.image && await m.edit(wishPayload(w)).then(() => true, () => false)) n++;
  }
  if (n) console.log('🖼️ Jeux · ' + n + ' carte(s) mise(s) à jour avec l\'image Steam');
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
  const refus = doublon(guild, nom, lien)
    || (guild.channels.cache.find(c => c.parentId === store.categoryId && c.name === nomSalon) && '⛔ Ce jeu existe déjà dans les jeux. · This game already exists.');
  if (refus) return reponse(refus);

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
      image: imageSteam(lien),
      footer: { text: 'MonCopainBot' },
    }] }),
    allowedMentions: { users: [] },
  }).catch(() => {});
  await interaction.editReply('✅ Salon créé : <#' + channel.id + '>');
}

// ── Wishlist : jeux pas encore sortis, votes « m'intéresse / ne m'intéresse pas » ──
function wishPayload(w) {
  const fmt = ids => ids.length ? ids.map(i => '<@' + i + '>').join(' ').slice(0, 1000) : '—';
  return {
    ...panneau({ embeds: [{
      title: '⭐ ' + w.nom.toUpperCase(),
      description: [w.lien ? '🔗 **Lien · Link :** ' + w.lien : null, w.date ? '📅 **Sortie · Release :** ' + w.date : null,
        'Proposé par · Added by <@' + w.auteur + '>'].filter(Boolean).join('\n'),
      color: 0xFEE75C,
      image: imageSteam(w.lien),
      fields: [
        { name: '👍 Ça m\'intéresse (' + w.y.length + ')', value: fmt(w.y), inline: true },
        { name: '👎 Ne m\'intéresse pas (' + w.n.length + ')', value: fmt(w.n), inline: true },
      ],
      footer: { text: 'MonCopainBot' },
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wish_y').setLabel('Ce jeu m\'intéresse').setEmoji('👍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wish_n').setLabel('Ne m\'intéresse pas').setEmoji('👎').setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { users: [] },
  };
}

async function handleWishButton(interaction) {
  const modal = new ModalBuilder().setCustomId('jeux_wishmodal').setTitle('Wishlist · Jeu à venir');
  const champ = (id, label, req, max) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label)
    .setStyle(TextInputStyle.Short).setMaxLength(max).setRequired(req));
  modal.addComponents(champ('nom', 'Nom du jeu · Game name', true, 60), champ('lien', 'Lien Steam ou site (optionnel) · Link', false, 300),
    champ('date', 'Date de sortie (optionnel) · Release date', false, 40));
  await interaction.showModal(modal);
}

async function handleWishModal(interaction) {
  const nom = interaction.fields.getTextInputValue('nom').trim();
  const brut = interaction.fields.getTextInputValue('lien').trim();
  const lien = brut ? lienValide(brut) : null;
  if (brut && !lien) return interaction.reply({ content: '❌ Lien invalide (https://…). · Invalid link.', flags: 64 });
  const refus = doublon(interaction.guild, nom, lien);
  if (refus) return interaction.reply({ content: refus, flags: 64 });
  const attente = COOLDOWN_MS - (Date.now() - (derniere.get(interaction.user.id) || 0));
  if (attente > 0) return interaction.reply({ content: '⏳ Patiente ' + Math.ceil(attente / 1000) + ' s. · Please wait.', flags: 64 });
  const channel = interaction.guild.channels.cache.get(store.wishId);
  if (!channel) return interaction.reply({ content: '⚠️ Salon wishlist introuvable. · Wishlist channel not found.', flags: 64 });
  derniere.set(interaction.user.id, Date.now());
  const w = { nom, lien, date: interaction.fields.getTextInputValue('date').trim(), auteur: interaction.user.id, y: [], n: [] };
  const msg = await channel.send(wishPayload(w));
  store.wish[msg.id] = w;
  save();
  await interaction.reply({ content: '✅ Ajouté : <#' + channel.id + '>', flags: 64 });
}

// Un clic vote, un second clic identique retire le vote ; voter l'autre côté change le vote.
async function handleWishVote(interaction) {
  const w = store.wish[interaction.message.id];
  if (!w) return interaction.reply({ content: '⚠️ Entrée inconnue. · Unknown entry.', flags: 64 });
  const [pour, contre] = interaction.customId === 'wish_y' ? ['y', 'n'] : ['n', 'y'];
  const uid = interaction.user.id;
  w[contre] = w[contre].filter(i => i !== uid);
  w[pour] = w[pour].includes(uid) ? w[pour].filter(i => i !== uid) : [...w[pour], uid];
  save();
  await interaction.update(wishPayload(w));
}

module.exports = { doublon, __store: () => store, imageSteam, startJeux, handleButton, handleModal, handleWishButton, handleWishModal, handleWishVote };
