const ids = require('./ids');
require('dotenv').config();
const fs = require('fs');
const db = require('./database');
const { dataPath } = require('./paths');

let _cfgStatus = '';
try { _cfgStatus = require('./config').get().STATUS_CHANNEL_ID || ''; } catch {}

// Salon unifié « bot-status » : priorité au .env (VERIFICATION_CHANNEL_ID), puis à l'ancienne clé
// STATUS_CHANNEL_ID / config dashboard, sinon la valeur fixe.
const STATUS_CHANNEL_ID = (process.env.VERIF_MODE === 'code' ? null : process.env.VERIFICATION_CHANNEL_ID)
  || process.env.STATUS_CHANNEL_ID || _cfgStatus || ids('VERIFICATION_CHANNEL_ID');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Centre de contrôle : UN message (console ANSI), remplacé à chaque actualisation (l'ancien est supprimé) ──
const MSG_FILE    = dataPath('status-msg.json');
const EVENTS_FILE = dataPath('status-events.json');
const LIVE_MS     = 60_000;
const MAX_EVENTS  = 300;
const W           = 50;          // largeur de la console (caractères)

const ESC = '\u001b[';
const c = (code, s) => ESC + code + 'm' + s + ESC + '0m';
const gris = s => c('0;37', s), cyan = s => c('1;36', s), vert = s => c('1;32', s), rouge = s => c('1;31', s);
const jaune = s => c('1;33', s), blanc = s => c('1;37', s), violet = s => c('1;35', s), bleu = s => c('1;34', s);

function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
function saveJson(file, data) { try { fs.writeFileSync(file, JSON.stringify(data)); } catch {} }

// Type d'événement : alimente les compteurs « vérification 24 h »
const TYPES = new Set(['member_join', 'member_left', 'verification_ok', 'verification_failed', 'member_activated', 'member_banned', 'raid_detected', 'antispam_ban']);

let _client = null, _events = null, _msg = null, _channel = null, _timer = null, _debounce = null;
const events = () => _events || (_events = loadJson(EVENTS_FILE, []));

// Appelé par logger.log() et antispam : enregistre l'événement et rafraîchit le message (au plus 1 fois / 4 s)
function pushEvent(type) {
  if (!TYPES.has(type)) return;
  events().push({ t: Date.now(), type });
  if (events().length > MAX_EVENTS) events().splice(0, events().length - MAX_EVENTS);
  saveJson(EVENTS_FILE, events());
  if (_channel && !_debounce) _debounce = setTimeout(() => { _debounce = null; refresh().catch(() => {}); }, 4000);
}

const hhmmss = t => new Date(t).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour12: false });
const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);
const ligne = (label, valeur, couleur = vert) => ' ' + gris('▸ ') + blanc(label) + ' ' + gris('·'.repeat(Math.max(2, 24 - label.length))) + ' ' + couleur(valeur);
const ping = () => Math.max(0, Math.round(_client.ws.ping));
const duree = s => { const j = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (j ? j + 'j ' : '') + String(h).padStart(2, '0') + 'h' + String(m).padStart(2, '0'); };

async function construire() {
  const stats = await db.getStats().catch(() => ({ total: 0, present: 0, banned: 0 }));
  const guild = _client.guilds.cache.get(process.env.GUILD_ID) || _client.guilds.cache.first();
  const r24 = events().filter(e => e.t >= Date.now() - 24 * 3600 * 1000);
  const n = type => r24.filter(e => e.type === type).length;
  const verifRole = guild?.roles.cache.get(process.env.VERIFICATION_ROLE_ID);
  const enCours = verifRole ? verifRole.members.size : null;
  const alerte = events().some(e => ['antispam_ban', 'raid_detected', 'member_banned'].includes(e.type) && Date.now() - e.t < 10 * 60 * 1000);
  let nbExpl = 0;
  try { nbExpl = require('./exploitation').getAll().filter(e => e.nom).length; } catch {}
  const mode = process.env.VERIF_MODE === 'code' ? 'CODE' : process.env.VERIF_MODE === 'code-compte' ? 'CODE + COMPTE' : 'CLASSIQUE';

  const out = [];
  out.push(cyan('╔' + '═'.repeat(W - 2) + '╗'));
  out.push(cyan('║') + blanc(pad(' ◢◤ ' + (guild?.name || 'SERVEUR').toUpperCase() + ' · SECURITY SYSTEM', W - 2 - 6)) + gris(' v2.1 ') + cyan('║'));
  out.push(cyan('╚' + '═'.repeat(W - 2) + '╝'));
  out.push(gris(' ┌─ ') + jaune('SYSTÈMES') + gris(' ' + '─'.repeat(W - 14)));
  out.push(ligne('Passerelle Discord', 'EN LIGNE · ' + ping() + ' ms'));
  out.push(ligne('Base de données', stats.total + ' fiches', cyan));
  out.push(ligne('Vérification joueurs', 'ARMÉE · ' + mode));
  if (process.env.ANTISPAM_CHANNEL_ID) out.push(ligne('Anti-spam (piège)', 'ACTIF'));
  out.push(ligne('Anti-raid', 'ACTIF'));
  out.push(ligne('Système de niveaux', 'ACTIF'));
  if (nbExpl) out.push(ligne('Exploitations', String(nbExpl), violet));
  out.push(gris(' ├─ ') + jaune('EN DIRECT') + gris(' ' + '─'.repeat(W - 15)));
  out.push(' ' + gris('⏱ ') + blanc('uptime ') + cyan(duree(process.uptime())) + gris('  ·  ') + blanc('ram ') + cyan(Math.round(process.memoryUsage().rss / 1048576) + ' Mo') + gris('  ·  ') + blanc('ping ') + cyan(ping() + ' ms'));
  out.push(' ' + gris('👥 ') + blanc('membres ') + cyan(guild?.memberCount ?? stats.total) + gris('  ·  ') + blanc('fiches présentes ') + cyan(stats.present) + gris('  ·  ') + blanc('bannis ') + rouge(stats.banned));
  out.push(gris(' └─ ') + jaune('VÉRIFICATION · 24 H') + gris(' ' + '─'.repeat(W - 25)));
  out.push(' ' + cyan('➜ ' + n('member_join')) + blanc(' arrivées') + gris('   ') + vert('✔ ' + (n('verification_ok') + n('member_activated'))) + blanc(' validés') + gris('   ')
    + (enCours ? jaune('⏳ ' + enCours) + blanc(' en cours') : gris('⏳ 0 en cours')));
  out.push(' ' + rouge('✖ ' + n('verification_failed')) + blanc(' refusés') + gris('   ') + rouge('☠ ' + n('antispam_ban')) + blanc(' pièges') + gris('   ') + gris('↩ ' + n('member_left') + ' départs'));

  return { embeds: [{
    title: '🛰️  CENTRE DE CONTRÔLE',
    description: '```ansi\n' + out.join('\n') + '\n```',
    color: alerte ? 0xE74C3C : enCours ? 0xE67E22 : 0x00E5FF,
    footer: { text: '● en direct · actualisé toutes les 60 s · ' + new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
  }] };
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

module.exports = { updateStatusMessage, trouverSalon, pushEvent, W, hhmmss, ansi: { gris, cyan, vert, rouge, jaune, blanc, violet, bleu } };
