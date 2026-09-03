const fs   = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Salon des rôles. Le bot y maintient UN SEUL message :
//   [ embed d'explication ]  +  [ boutons de rôle ]
// Les boutons sont ajoutés/retirés via /bouton et le message se re-rend.
const ROLES_CHANNEL = '1538537709633802270';
const { dataPath } = require('./paths');
const STORE_PATH   = dataPath('roles-panel.json');
const MAX_BOUTONS   = 25; // 5 rangées de 5

const STYLES = {
  Primary:   ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success:   ButtonStyle.Success,
  Danger:    ButtonStyle.Danger,
};

function loadStore() {
  try {
    const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return { messageId: s.messageId || null, buttons: Array.isArray(s.buttons) ? s.buttons : [] };
  } catch {
    return { messageId: null, buttons: [] };
  }
}

function saveStore(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
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

function buildComponents(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const b of buttons.slice(i, i + 5)) {
      const btn = new ButtonBuilder()
        .setCustomId('role_' + b.roleId)
        .setLabel(b.label)
        .setStyle(STYLES[b.style] || ButtonStyle.Primary);
      if (b.emoji) { try { btn.setEmoji(b.emoji); } catch { /* emoji invalide → ignoré */ } }
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

async function _channel(client) {
  return client.channels.cache.get(ROLES_CHANNEL)
    || await client.channels.fetch(ROLES_CHANNEL).catch(() => null);
}

// Rend le panneau : édite le message existant sur place (il ne bouge pas),
// sinon en poste un nouveau.
async function renderPanel(client) {
  const channel = await _channel(client);
  if (!channel) {
    console.error('⚠️ roles.js — salon ' + ROLES_CHANNEL + ' introuvable');
    return;
  }

  const store   = loadStore();
  const payload = { embeds: [headerEmbed()], components: buildComponents(store.buttons) };

  if (store.messageId) {
    const msg = await channel.messages.fetch(store.messageId).catch(() => null);
    if (msg && msg.author.id === client.user.id) {
      await msg.edit(payload).catch(() => {});
      console.log('🎭 Panneau des rôles actualisé (' + store.buttons.length + ' bouton(s))');
      return;
    }
  }

  const sent = await channel.send(payload).catch(() => null);
  if (sent) {
    store.messageId = sent.id;
    saveStore(store);
    console.log('🎭 Panneau des rôles publié');
  }
}

async function addRoleButton(client, { roleId, label, emoji = '', style = 'Primary' }) {
  const store    = loadStore();
  const existing = store.buttons.find(b => b.roleId === roleId);

  if (existing) {
    existing.label = label;
    existing.emoji = emoji;
    existing.style = style;
  } else {
    if (store.buttons.length >= MAX_BOUTONS) return { ok: false, reason: 'max' };
    store.buttons.push({ roleId, label, emoji, style });
  }

  saveStore(store);
  await renderPanel(client);
  return { ok: true, count: store.buttons.length, updated: !!existing };
}

async function removeRoleButton(client, roleId) {
  const store  = loadStore();
  const before = store.buttons.length;
  store.buttons = store.buttons.filter(b => b.roleId !== roleId);
  if (store.buttons.length === before) return { ok: false, reason: 'notfound' };

  saveStore(store);
  await renderPanel(client);
  return { ok: true, count: store.buttons.length };
}

function listRoleButtons() {
  return loadStore().buttons;
}

module.exports = {
  ROLES_CHANNEL,
  renderPanel,
  postRolesHeader: renderPanel, // alias historique (appelé depuis index.js)
  addRoleButton,
  removeRoleButton,
  listRoleButtons,
};
