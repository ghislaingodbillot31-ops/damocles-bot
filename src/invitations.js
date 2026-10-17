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

function panelPayload() {
  return panneau({
    embeds: [{
      title: '🔗  INVITER DES JOUEURS · INVITE PLAYERS',
      description: [
        '🇫🇷 **Français**',
        'Clique sur **LIEN D\'INVITATION** pour générer ton lien personnel et invite tes amis sur le serveur.',
        '> • Ton lien est valable **7 jours**, puis il expire.',
        '> • Tu es crédité de chaque joueur qui arrive grâce à lui, et son arrivée est annoncée dans **bienvenue**.',
        '',
        '🇬🇧 **English**',
        'Click **INVITATION LINK** to generate your personal link and invite your friends to the server.',
        '> • Your link is valid for **7 days**, then it expires.',
        '> • You get credit for every player who joins through it, and their arrival is announced in **bienvenue**.',
      ].join('\n'),
      color: 0x5865F2,
      footer: { text: 'DOMINIUS' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lien_invite').setLabel('🔗 LIEN D\'INVITATION · INVITATION LINK').setStyle(ButtonStyle.Primary),
    )],
  });
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
  await interaction.editReply({ content: 'https://discord.gg/' + code, ...panneau({ embeds: [{
    title: '🔗 TON LIEN · YOUR LINK',
    description: '⏳ Valable jusqu\'au · Valid until <t:' + exp + ':f>',
    color: 0x5865F2,
  }] }) });
}

module.exports = { startInvitations, handleInviteButton, createur };
