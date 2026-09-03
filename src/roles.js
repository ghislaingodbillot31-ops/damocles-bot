const fs   = require('fs');
const path = require('path');

// Salon des rôles — l'en-tête explicatif s'y auto-poste au démarrage.
// Les boutons de rôle eux-mêmes sont ajoutés à la main via /bouton [nom] [rôle].
const ROLES_CHANNEL = '1538537709633802270';
const STORE_PATH    = path.join(__dirname, '..', 'data', 'roles-header.json');

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveStore(data) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ roles.js — sauvegarde impossible :', err.message);
  }
}

function headerEmbed() {
  return {
    color: 0x5865F2,
    description: [
      '## 🎭 Choisis tes rôles',
      '',
      'Clique sur un bouton ci-dessous pour **obtenir** le rôle correspondant.',
      'Reclique dessus pour le **retirer**.',
      '',
      'Tu peux en prendre autant que tu veux, et changer d\'avis quand tu veux.',
      '',
      '🟢 Bouton cliqué → rôle ajouté',
      '🔴 Bouton recliqué → rôle enlevé',
      '',
      '*Les rôles te donnent accès à des salons, des notifications ou juste un badge sur ton profil.*',
    ].join('\n'),
  };
}

// Poste l'en-tête s'il n'existe pas encore, sinon le met à jour sur place
// (il ne bouge pas → il reste en haut du salon, au-dessus des boutons).
async function postRolesHeader(client) {
  const channel = client.channels.cache.get(ROLES_CHANNEL)
    || await client.channels.fetch(ROLES_CHANNEL).catch(() => null);
  if (!channel) {
    console.error('⚠️ roles.js — salon ' + ROLES_CHANNEL + ' introuvable');
    return;
  }

  const store = loadStore();
  const embed = headerEmbed();

  if (store.messageId) {
    const existing = await channel.messages.fetch(store.messageId).catch(() => null);
    if (existing && existing.author.id === client.user.id) {
      await existing.edit({ embeds: [embed] }).catch(() => {});
      console.log('🎭 En-tête des rôles actualisé');
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    saveStore({ messageId: sent.id, channelId: channel.id });
    console.log('🎭 En-tête des rôles publié');
  }
}

module.exports = { ROLES_CHANNEL, postRolesHeader };
