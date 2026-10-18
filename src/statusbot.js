const ids = require('./ids');
require('dotenv').config();
const fs = require('fs');
const db = require('./database');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

let _cfgStatus = '';
try { _cfgStatus = require('./config').get().STATUS_CHANNEL_ID || ''; } catch {}

// Salon unifié « bot-status » : priorité au .env (VERIFICATION_CHANNEL_ID), puis à l'ancienne clé
// STATUS_CHANNEL_ID / config dashboard, sinon la valeur fixe.
const STATUS_CHANNEL_ID = (process.env.VERIF_MODE === 'code' ? null : process.env.VERIFICATION_CHANNEL_ID)
  || process.env.STATUS_CHANNEL_ID || _cfgStatus || ids('VERIFICATION_CHANNEL_ID');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Centre de contrôle : UN message (embed natif), remplacé à chaque actualisation (l'ancien est supprimé) ──
const MSG_FILE    = dataPath('status-msg.json');
const EVENTS_FILE = dataPath('status-events.json');
const LIVE_MS     = 5 * 60_000;
const MAX_EVENTS  = 300;

function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
function saveJson(file, data) { try { fs.writeFileSync(file, JSON.stringify(data)); } catch {} }

// Type d'événement : alimente les compteurs « vérification 24 h »
const TYPES = new Set(['member_join', 'member_left', 'verification_ok', 'verification_failed', 'member_activated', 'member_banned', 'raid_detected', 'antispam_ban']);

let _client = null, _events = null, _msg = null, _channel = null, _timer = null;
const events = () => _events || (_events = loadJson(EVENTS_FILE, []));

// Appelé par logger.log() et antispam : enregistre l'événement (compteurs 24 h) ; le message est actualisé toutes les 5 minutes
function pushEvent(type) {
  if (!TYPES.has(type)) return;
  events().push({ t: Date.now(), type });
  if (events().length > MAX_EVENTS) events().splice(0, events().length - MAX_EVENTS);
  saveJson(EVENTS_FILE, events());
}

const duree = s => { const j = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (j ? j + 'j ' : '') + h + 'h' + String(m).padStart(2, '0'); };

async function construire() {
  const stats = await db.getStats().catch(() => ({ total: 0, present: 0, banned: 0 }));
  const guild = _client.guilds.cache.get(process.env.GUILD_ID) || _client.guilds.cache.first();
  const r24 = events().filter(e => e.t >= Date.now() - 24 * 3600 * 1000);
  const n = type => r24.filter(e => e.type === type).length;
  const verifRole = guild?.roles.cache.get(process.env.VERIFICATION_ROLE_ID);
  const enCours = verifRole ? verifRole.members.size : 0;
  const alerte = events().some(e => ['antispam_ban', 'raid_detected', 'member_banned'].includes(e.type) && Date.now() - e.t < 10 * 60 * 1000);
  let nbExpl = 0;
  try { nbExpl = require('./exploitation').getAll().filter(e => e.nom).length; } catch {}
  const mode = process.env.VERIF_MODE === 'code' ? 'Code' : process.env.VERIF_MODE === 'code-compte' ? 'Code + compte' : 'Classique';
  const ping = Math.max(0, Math.round(_client.ws.ping));

  return panneau({ embeds: [{
    title: '🛰️ Centre de contrôle',
    color: alerte ? 0xE74C3C : enCours ? 0xE67E22 : 0x2ECC71,
    fields: [
      { name: '⚙️ Systèmes', value: [
        '**Passerelle Discord** · en ligne · ' + ping + ' ms',
        '**Base de données** · ' + stats.total + ' fiches',
        '**Vérification joueurs** · armée · ' + mode,
        ...(process.env.ANTISPAM_CHANNEL_ID ? ['**Anti-spam (piège)** · actif'] : []),
        '**Anti-raid** · actif',
        '**Système de niveaux** · actif',
        ...(nbExpl ? ['**Exploitations** · ' + nbExpl] : []),
      ].join('\n') },
      { name: '📡 En direct', value: [
        '**Uptime** · ' + duree(process.uptime()) + ' · **RAM** · ' + Math.round(process.memoryUsage().rss / 1048576) + ' Mo · **Ping** · ' + ping + ' ms',
        '**Membres** · ' + (guild?.memberCount ?? stats.total) + ' · **Fiches présentes** · ' + stats.present + ' · **Bannis** · ' + stats.banned,
      ].join('\n') },
      { name: '🔍 Vérification · 24 h', value: [
        '➜ ' + n('member_join') + ' arrivées · ✅ ' + (n('verification_ok') + n('member_activated')) + ' validés · ⏳ ' + enCours + ' en cours',
        '❌ ' + n('verification_failed') + ' refusés · ☠️ ' + n('antispam_ban') + ' pièges · ↩️ ' + n('member_left') + ' départs',
      ].join('\n') },
    ],
    footer: { text: 'MonCopainBot · actualisé toutes les 5 min' },
    timestamp: new Date().toISOString(),
  }] });
}

// Supprime l'ancien embed puis publie le nouveau
async function refresh() {
  if (!_channel) return;
  const payload = await construire();
  const ancien = _msg || (loadJson(MSG_FILE, {}).id && await _channel.messages.fetch(loadJson(MSG_FILE, {}).id).catch(() => null));
  _msg = await _channel.send(payload).catch(() => null);
  if (_msg) { saveJson(MSG_FILE, { id: _msg.id }); await ancien?.delete().catch(() => {}); }
  else _msg = ancien || null;
}

// Salon : l'ID configuré s'il existe, sinon le salon nommé « bot-status »
function trouverSalon(client) {
  const parId = STATUS_CHANNEL_ID && client.channels.cache.get(STATUS_CHANNEL_ID);
  if (parId) return parId;
  const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
  return guild?.channels.cache.find(ch => ch.isTextBased() && ch.name.includes('bot-status')) || null;
}

async function updateStatusMessage(client, animated = false) {
  if (!animated) return;
  _client = client;
  _channel = trouverSalon(client);
  if (!_channel) { console.error('⚠️ Centre de contrôle : salon introuvable (STATUS_CHANNEL_ID=' + (STATUS_CHANNEL_ID || 'vide') + ', aucun salon « bot-status »)'); return; }
  console.log('🛰️ Centre de contrôle · publication dans #' + _channel.name);
  await refresh();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => refresh().catch(() => {}), LIVE_MS);
}

module.exports = { updateStatusMessage, trouverSalon, pushEvent };

