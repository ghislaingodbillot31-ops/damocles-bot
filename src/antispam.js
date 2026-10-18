const ids = require('./ids');
const fs = require('fs');
const { PermissionFlagsBits } = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

// Salon-piège (honeypot), en tête du serveur avec l'accueil : visible et ouvert à tous. Les robots de spam y écrivent
// partout où ils le peuvent → tout message d'un non-staff dans ce salon = bannissement automatique.
const TRAP = ids('ANTISPAM_CHANNEL_ID');
const STORE_PATH = dataPath('antispam.json');
let store = { panelMsgId: null, bans: 0 };
try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const STAFF = PermissionFlagsBits.ManageMessages;

function panelPayload() {
  return panneau({ embeds: [{
    title: '⛔  NE PAS ÉCRIRE ICI · DO NOT WRITE HERE',
    description: [
      '🇫🇷 Ce salon est une **protection anti-spam**. **Tout message envoyé ici entraîne un bannissement automatique et immédiat.**',
      '🇬🇧 This channel is an **anti-spam trap**. **Any message sent here results in an immediate, automatic ban.**',
    ].join('\n\n'),
    color: 0xE74C3C,
    footer: { text: 'Anti-spam · salon-piège' },
  }] });
}

// Retourne true si le message était dans le salon-piège (il ne doit alors plus être traité).
async function onMessage(message) {
  if (!TRAP || message.channelId !== TRAP || !message.guild || message.author.bot) return false;
  const member = message.member;
  const protege = !member || member.permissions.has(STAFF) || member.permissions.has(PermissionFlagsBits.Administrator)
    || message.author.id === message.guild.ownerId;
  await message.delete().catch(() => {});
  if (protege) return true; // le staff peut écrire, sans conséquence

  const raison = 'Anti-spam : message dans le salon-piège';
  try {
    await message.guild.members.ban(message.author, { reason: raison, deleteMessageSeconds: 24 * 3600 });
    store.bans++; save();
    try { require('./statusbot').pushEvent('antispam_ban'); } catch {}
    console.log('🚫 Anti-spam : ' + message.author.tag + ' banni');
  } catch (err) {
    console.error('⚠️ Anti-spam : ban impossible (' + message.author.tag + ') :', err.message);
  }
  const logId = process.env.DAMOCLES_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  const log = logId && (message.client.channels.cache.get(logId) || await message.client.channels.fetch(logId).catch(() => null));
  await log?.send({ embeds: [{
    title: '🚫 Anti-spam · bannissement automatique',
    description: '**' + message.author.tag + '** (<@' + message.author.id + '>) a écrit dans le salon-piège.\n> ' + (message.content || '*(sans texte)*').slice(0, 300),
    color: 0xE74C3C, timestamp: new Date().toISOString(),
  }], allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

// À chaque démarrage : ancien panneau supprimé, nouveau publié.
async function startAntiSpam(client) {
  try {
    const ch = TRAP && (client.channels.cache.get(TRAP) || await client.channels.fetch(TRAP).catch(() => null));
    if (!ch) { console.error('⚠️ Anti-spam : salon-piège introuvable (ANTISPAM_CHANNEL_ID)'); return; }
    const ancien = store.panelMsgId && await ch.messages.fetch(store.panelMsgId).catch(() => null);
    if (ancien) await ancien.delete().catch(() => {});
    store.panelMsgId = (await ch.send(panelPayload()).catch(() => null))?.id || null;
    save();
    await require('./nettoyage').epurer(client, ch.id);
    console.log('🚫 Anti-spam · prêt (salon-piège : #' + ch.name + ')');
  } catch (err) { console.error('⚠️ Anti-spam :', err.message); }
}

module.exports = { startAntiSpam, onMessage };
