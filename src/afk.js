const fs   = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');
const { log }         = require('./logger');
const { dataPath }    = require('./paths');

// ── Config ────────────────────────────────────────────────────────────────────
const AFK_CHANNEL_NAME = '🌙 AFK';
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

  if (afkChannelId && guild.channels.cache.get(afkChannelId)) return afkChannelId;

  const existant = guild.channels.cache.find(
    c => c.type === ChannelType.GuildVoice && c.name === AFK_CHANNEL_NAME,
  );
  if (existant) {
    afkChannelId = existant.id;
    save();
    return afkChannelId;
  }

  try {
    const channel = await guild.channels.create({
      name: AFK_CHANNEL_NAME,
      type: ChannelType.GuildVoice,
      reason: 'Salon AFK · joueurs inactifs en vocal',
    });
    afkChannelId = channel.id;
    save();
    return afkChannelId;
  } catch (err) {
    console.error('⚠️ AFK — création du salon impossible :', err.message);
    return null;
  }
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

// ── VoiceStateUpdate → suivi de l'activité ────────────────────────────────────
function handleVoiceState(oldState, newState) {
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  const userId = newState.id;

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
