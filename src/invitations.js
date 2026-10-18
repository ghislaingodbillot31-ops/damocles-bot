const ids = require('./ids');
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

// HUB des invitations (catégorie COMMUNAUTÉ) : le bouton génère un lien Discord valable 7 jours.
// Chaque lien est rattaché à son créateur pour que l'invitation lui soit bien attribuée (voir levels.onMemberAdd).
const HUB_CHANNEL = ids('INVITE_HUB_CHANNEL_ID');
const STORE_PATH  = dataPath('invitations.json');
const DUREE_S     = 7 * 24 * 3600;

// { panelMsgId, links: { code: { userId, expiresAt } } }
let store = { panelMsgId: null, links: {} };

function load() {
  try { store = { panelMsgId: null, links: {}, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
}
function save() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {}
}
load();

// Créateur (userId) d'un lien généré par le bot, sinon null.
const createur = code => store.links[code]?.userId || null;

// HUB COMMUNAUTAIRE : bouton Invitation (lien personnel de 7 jours) + bouton Rôles (prendre / retirer un rôle d'un clic).
// Les boutons de rôle sont ceux de la commande /bouton (roles.js) : /bouton role:@Rôle nom:Mon nom emoji:🎮 couleur:Vert.
function panelPayload() {
  return panneau({
    embeds: [{
      title: '🏘️  HUB COMMUNAUTAIRE · COMMUNITY HUB',
      description: [
        '## 🔗 Invitation',
        'Génère ton **lien personnel** (valable 7 jours) et invite tes amis. Tu es crédité de chaque joueur qui arrive grâce à lui.',
        'Generate your **personal link** (valid 7 days) and invite your friends. You get credit for every player who joins.',
        '',
        '## 🎭 Rôles',
        'Choisis tes rôles : **un clic pour le prendre, un autre clic pour le retirer**.',
        'Pick your roles: **click once to take it, click again to remove it**.',
      ].join('\n'),
      color: 0x00E5FF,
      footer: { text: 'Le Coin des Copains' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lien_invite').setLabel('🔗 Invitation').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hub_roles').setLabel('🎭 Rôles').setStyle(ButtonStyle.Success),
    )],
  });
}

// Liste des rôles proposés, vue du joueur : vert = il a le rôle, gris = il ne l'a pas
function listeRoles(member) {
  const boutons = require('./roles').listRoleButtons().filter(b => member.guild.roles.cache.has(b.roleId));
  const rows = [];
  for (let i = 0; i < boutons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(boutons.slice(i, i + 5).map(b => {
      const btn = new ButtonBuilder().setCustomId('hubrole_' + b.roleId).setLabel(b.label)
        .setStyle(member.roles.cache.has(b.roleId) ? ButtonStyle.Success : ButtonStyle.Secondary);
      if (b.emoji) { try { btn.setEmoji(b.emoji); } catch { /* emoji invalide : ignoré */ } }
      return btn;
    })));
  }
  return { rows, vide: !boutons.length };
}

function payloadRoles(member) {
  const { rows, vide } = listeRoles(member);
  return {
    ...panneau({ embeds: [{
      title: '🎭 TES RÔLES · YOUR ROLES',
      description: vide
        ? 'Aucun rôle n\'est proposé pour le moment. · No roles available yet.'
        : '🟢 vert = tu as le rôle · 🔘 gris = tu ne l\'as pas\nClique pour le **prendre**, reclique pour le **retirer**.\nClick to **take** it, click again to **remove** it.',
      color: 0x5865F2,
    }] }),
    components: rows,
  };
}

async function handleRolesButton(interaction) {
  await interaction.reply({ ...payloadRoles(interaction.member), flags: 64 });
}

// Prend ou retire le rôle, puis rafraîchit la liste sur place
async function handleRoleToggle(interaction) {
  const roleId = interaction.customId.replace('hubrole_', '');
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.reply({ content: '❌ Rôle introuvable · Role not found.', flags: 64 });
  const member = interaction.member;
  const avait = member.roles.cache.has(roleId);
  try {
    if (avait) await member.roles.remove(role); else await member.roles.add(role);
  } catch {
    return interaction.reply({ content: '❌ Impossible de modifier ce rôle (permission du bot) · Could not change this role.', flags: 64 });
  }
  require('./logger').log(interaction.client, avait ? 'role_removed' : 'role_added', { userId: member.id, roleName: role.name, publicOnly: true });
  await interaction.update(payloadRoles(await interaction.guild.members.fetch(member.id)));
}

async function salon(client) {
  return HUB_CHANNEL && (client.channels.cache.get(HUB_CHANNEL) || await client.channels.fetch(HUB_CHANNEL).catch(() => null));
}

// À chaque démarrage : l'ancien panneau est supprimé, un nouveau est publié.
async function startInvitations(client) {
  try {
    const channel = await salon(client);
    if (!channel) { console.error('⚠️ Invitations : salon HUB introuvable (INVITE_HUB_CHANNEL_ID)'); return; }
    const ancien = store.panelMsgId && await channel.messages.fetch(store.panelMsgId).catch(() => null);
    if (ancien) await ancien.delete().catch(() => {});
    const msg = await channel.send(panelPayload()).catch(err => { console.error('⚠️ Invitations :', err.message); return null; });
    store.panelMsgId = msg?.id || null;
    save();
    await require('./nettoyage').epurer(client, channel.id);
    console.log('🔗 Invitations · prêt (HUB : #' + channel.name + ')');
  } catch (err) {
    console.error('⚠️ Invitations :', err.message);
  }
}

// Bouton « LIEN D'INVITATION » : renvoie le lien encore valide du joueur, ou en crée un (7 jours).
async function handleInviteButton(interaction) {
  await interaction.deferReply({ flags: 64 });
  const uid = interaction.user.id, now = Date.now();
  for (const [code, l] of Object.entries(store.links)) if (l.expiresAt < now) delete store.links[code];

  let code = Object.keys(store.links).find(c => store.links[c].userId === uid);
  if (!code) {
    const channel = interaction.channel?.type === ChannelType.GuildText ? interaction.channel : await salon(interaction.client);
    const inv = await channel?.createInvite({
      maxAge: DUREE_S, maxUses: 0, unique: true, reason: 'Lien d\'invitation de ' + interaction.user.tag,
    }).catch(() => null);
    if (!inv) return interaction.editReply('⚠️ Impossible de créer le lien (permission manquante) · Could not create the link.');
    code = inv.code;
    store.links[code] = { userId: uid, expiresAt: now + DUREE_S * 1000 };
  }
  save();
  const exp = Math.floor(store.links[code].expiresAt / 1000);
  // le lien reste en texte brut au-dessus du panneau pour rester cliquable et facile à copier
  const lien = {
    content: 'https://discord.gg/' + code,
    ...panneau({ embeds: [{
      title: '🔗 TON LIEN · YOUR LINK',
      description: '⏳ Valable jusqu\'au · Valid until <t:' + exp + ':f>',
      color: 0x5865F2,
    }] }),
  };
  // envoyé en message privé ; si les MP sont fermés, affiché ici (visible par toi seul)
  const mp = await interaction.user.send(lien).then(() => true).catch(() => false);
  await interaction.editReply(mp
    ? 'Ton lien d\'invitation t\'a été envoyé en message privé. / Your invite link was sent to you by DM.'
    : { ...lien, content: 'Tes MP sont fermés, voici ton lien. / Your DMs are closed, here is your link.\n' + lien.content });
}

module.exports = { startInvitations, handleInviteButton, handleRolesButton, handleRoleToggle, createur };
