const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'scheduled-messages.json');

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

// Timers actifs : id -> NodeJS.Timeout
const timers = new Map();

// ── Persistance ───────────────────────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DATA_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch { return []; }
}

function save(messages) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(messages, null, 2), 'utf-8');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
function getAll() {
  return load();
}

function create(data) {
  const messages = load();
  const msg = {
    id:              newId(),
    name:            data.name || 'Sans nom',
    channelId:       data.channelId,
    message:         data.message,
    intervalMinutes: parseInt(data.intervalMinutes) || 60,
    color:           data.color || '5865F2',
    enabled:         data.enabled !== false,
    createdAt:       new Date().toISOString(),
    lastSent:        null,
    nextSend:        data.enabled !== false
      ? new Date(Date.now() + (parseInt(data.intervalMinutes) || 60) * 60000).toISOString()
      : null,
  };
  messages.push(msg);
  save(messages);
  return msg;
}

function update(id, data, client) {
  const messages = load();
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) return null;

  const old = messages[idx];
  const updated = {
    ...old,
    name:            data.name            ?? old.name,
    channelId:       data.channelId       ?? old.channelId,
    message:         data.message         ?? old.message,
    intervalMinutes: data.intervalMinutes !== undefined ? parseInt(data.intervalMinutes) : old.intervalMinutes,
    color:           data.color           ?? old.color,
    enabled:         data.enabled         !== undefined ? data.enabled : old.enabled,
  };

  // Recalculer nextSend si l'intervalle a changé ou si on réactive
  if (updated.enabled) {
    updated.nextSend = new Date(Date.now() + updated.intervalMinutes * 60000).toISOString();
  } else {
    updated.nextSend = null;
  }

  messages[idx] = updated;
  save(messages);

  // Redémarrer le timer
  clearTimer(id);
  if (updated.enabled && client) startTimer(updated, client);

  return updated;
}

function remove(id) {
  clearTimer(id);
  const messages = load().filter(m => m.id !== id);
  save(messages);
}

// ── Timers ────────────────────────────────────────────────────────────────────
function clearTimer(id) {
  if (timers.has(id)) {
    clearInterval(timers.get(id));
    timers.delete(id);
  }
}

function startTimer(msg, client) {
  if (!msg.enabled || !client) return;
  clearTimer(msg.id);

  const intervalMs = msg.intervalMinutes * 60 * 1000;
  const timer = setInterval(async () => {
    await sendMessage(msg.id, client);
  }, intervalMs);

  timers.set(msg.id, timer);
  console.log(`⏱ Message récurrent "${msg.name}" — toutes les ${msg.intervalMinutes} min`);
}

function startAll(client) {
  const messages = load();
  let started = 0;
  for (const msg of messages) {
    if (msg.enabled) {
      startTimer(msg, client);
      started++;
    }
  }
  if (started > 0) console.log(`📢 ${started} message(s) récurrent(s) démarré(s)`);
}

// ── Envoi ─────────────────────────────────────────────────────────────────────
async function sendMessage(id, client) {
  const messages = load();
  const msg = messages.find(m => m.id === id);
  if (!msg || !msg.enabled) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(msg.channelId);
  if (!channel) {
    console.error(`❌ Message récurrent "${msg.name}" — salon introuvable : ${msg.channelId}`);
    return;
  }

  try {
    await channel.send({
      embeds: [{
        description: msg.message,
        color: parseInt(msg.color, 16) || 0x5865F2,
        footer: { text: 'Damoclès Bot' },
        timestamp: new Date().toISOString(),
      }]
    });

    // Mettre à jour lastSent et nextSend
    const idx = messages.findIndex(m => m.id === id);
    if (idx !== -1) {
      messages[idx].lastSent = new Date().toISOString();
      messages[idx].nextSend = new Date(Date.now() + msg.intervalMinutes * 60000).toISOString();
      save(messages);
    }

    console.log(`📢 Message récurrent envoyé : "${msg.name}" → #${channel.name}`);
  } catch (err) {
    console.error(`❌ Erreur envoi message récurrent "${msg.name}" :`, err.message);
  }
}

async function sendNow(id, client) {
  const msg = load().find(m => m.id === id);
  if (!msg) throw new Error('Message introuvable');
  await sendMessage(id, client);
}

module.exports = { getAll, create, update, remove, startTimer, startAll, sendNow };
