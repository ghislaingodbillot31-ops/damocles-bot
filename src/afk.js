const fs   = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');
const { log }         = require('./logger');
const { dataPath }    = require('./paths');

// ── Config ────────────────────────────────────────────────────────────────────
const AFK_CHANNEL_NAME = '🌙 AFK';
const AFK_CATEGORY_ID  = '1345486205810118806';
const INACTIVITY_MS    = 5 * 60 * 1000; // délai avant déplacement
const SWEEP_MS         = 30_000;        // fréquence de vérification
const STORE_PATH       = dataPath('afk.json');

let afkChannelId = null;
// userId -> timestamp de la dernière activité vocale
const lastActivity = new Map();

// ── Persistance (juste l'id du salon AFK) ─────────────────────────────────────
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    afkChannelId = raw.channelId || null;
  } catch {}
}
function save() {
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ channelId: afkChannelId }, null, 2), 'utf-8');
  } catch {}
}

// ── Créer / retrouver le salon AFK ────────────────────────────────────────────
async function ensureAfkChannel(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return null;

  let channel = afkChannelId ? guild.channels.cache.get(afkChannelId) : null;

  if (!channel) {
    channel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildVoice && c.name === AFK_CHANNEL_NAME,
    );
  }

  if (!channel) {
    try {
      channel = await guild.channels.create({
        name: AFK_CHANNEL_NAME,
        type: ChannelType.GuildVoice,
        parent: AFK_CATEGORY_ID,
        reason: 'Salon AFK · joueurs inactifs en vocal',
      });
    } catch (err) {
      console.error('⚠️ AFK — création du salon impossible :', err.message);
      return null;
    }
  } else if (channel.parentId !== AFK_CATEGORY_ID) {
    try {
      await channel.setParent(AFK_CATEGORY_ID, { lockPermissions: false, reason: 'Salon AFK · rattachement à la bonne catégorie' });
    } catch (err) {
      console.error('⚠️ AFK — déplacement dans la catégorie impossible :', err.message);
    }
  }

  afkChannelId = channel.id;
  save();
  return afkChannelId;
}

// ── Initialiser l'activité des membres déjà connectés au démarrage ───────────
function seedActivity(guild) {
  const now = Date.now();
  for (const [, state] of guild.voiceStates.cache) {
    if (!state.channelId || state.channelId === afkChannelId) continue;
    if (state.member?.user?.bot) continue;
    lastActivity.set(state.id, now);
  }
}

// ── VoiceStateUpdate → suivi de l'activité + micro coupé dans le salon AFK ────
function handleVoiceState(oldState, newState) {
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  const userId = newState.id;

  // Entrée dans le salon AFK → micro coupé côté serveur
  if (afkChannelId && newState.channelId === afkChannelId && !newState.serverMute) {
    newState.setMute(true, 'Salon AFK · micro coupé').catch(() => {});
  }
  // Sortie du salon AFK → micro réactivé
  if (afkChannelId && oldState.channelId === afkChannelId && newState.channelId && newState.channelId !== afkChannelId && newState.serverMute) {
    newState.setMute(false, 'Sortie du salon AFK').catch(() => {});
  }

  // A quitté le vocal complètement
  if (!newState.channelId) {
    lastActivity.delete(userId);
    return;
  }

  // Toute autre mise à jour (join, switch, mute/déf, vidéo, stream…) = activité
  lastActivity.set(userId, Date.now());
}

// ── Déplacement des inactifs ───────────────────────────────────────────────────
async function sweep(client) {
  if (!afkChannelId) return;
  const guild = client.guilds.cache.first();
  if (!guild || !guild.channels.cache.get(afkChannelId)) return;

  const now = Date.now();
  for (const [userId, ts] of [...lastActivity.entries()]) {
    const state = guild.voiceStates.cache.get(userId);
    if (!state || !state.channelId) { lastActivity.delete(userId); continue; }
    if (state.channelId === afkChannelId) continue;
    if (now - ts < INACTIVITY_MS) continue;

    try {
      await state.setChannel(afkChannelId, 'Inactif en vocal depuis 5 minutes');
      lastActivity.set(userId, now);
      await log(client, 'voice_afk_moved', { userId }).catch?.(() => {});
      console.log('🌙 Déplacé en AFK (inactivité) : ' + userId);
    } catch (err) {
      console.error('⚠️ AFK — déplacement impossible pour ' + userId + ' :', err.message);
    }
  }
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startAfk(client) {
  load();
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await ensureAfkChannel(client);
  seedActivity(guild);
  setInterval(() => sweep(client).catch(() => {}), SWEEP_MS);
  console.log('🌙 Salon vocal AFK — prêt');
}

function getAfkChannelId() { return afkChannelId; }

module.exports = { startAfk, handleVoiceState, getAfkChannelId };
