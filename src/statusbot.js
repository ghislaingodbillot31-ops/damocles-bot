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
  || process.env.STATUS_CHANNEL_ID || _cfgStatus || ids('VERIFICATION_CHANNEL_ID', '1538533342150918246');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Centre de contrôle : UN message, console ANSI, actualisé toutes les minutes ─────────────
// À chaque (re)démarrage : séquence de boot animée dans un NOUVEAU message, l'ancien est supprimé.
// Les événements (arrivées, vérifications, bans, anti-spam…) alimentent le journal en direct.
const MSG_FILE    = dataPath('status-msg.json');
const EVENTS_FILE = dataPath('status-events.json');
const LIVE_MS     = 60_000;
const W           = 50;          // largeur de la console (caractères)
const MAX_EVENTS  = 300;
const JOURNAL_LIGNES = 9;

const ESC = '\u001b[';
const c = (code, s) => ESC + code + 'm' + s + ESC + '0m';
const gris = s => c('1;30', s), cyan = s => c('1;36', s), vert = s => c('1;32', s), rouge = s => c('1;31', s);
const jaune = s => c('1;33', s), blanc = s => c('1;37', s), violet = s => c('1;35', s), bleu = s => c('1;34', s);

function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
function saveJson(file, data) { try { fs.writeFileSync(file, JSON.stringify(data)); } catch {} }

// Type d'événement → [étiquette 7 car., couleur, verbe]
const TYPES = {
  member_join:         ['JOIN   ', cyan,   'arrive'],
  member_left:         ['LEAVE  ', gris,   'part'],
  verification_ok:     ['VÉRIF ✔', vert,   'validé'],
  verification_failed: ['VÉRIF ✖', rouge,  'refusé'],
  reglement_accepted:  ['RÈGLE ✔', bleu,   'règlement accepté'],
  member_activated:    ['ACTIF  ', vert,   'activé'],
  member_kicked:       ['KICK   ', jaune,  'expulsé'],
  member_banned:       ['BAN    ', rouge,  'banni'],
  warning_added:       ['WARN   ', jaune,  'averti'],
  raid_detected:       ['RAID ⚠ ', rouge,  'raid détecté'],
  spam_detected:       ['SPAM   ', rouge,  'spam'],
  antispam_ban:        ['PIÈGE  ', rouge,  'banni (salon-piège)'],
  link_detected:       ['LIEN   ', jaune,  'lien suspect'],
  ticket_created:      ['TICKET ', bleu,   'ouvre un ticket'],
  messages_purged:     ['PURGE  ', jaune,  'purge'],
};

let _client = null, _events = null, _msg = null, _channel = null, _timer = null, _debounce = null;
const events = () => _events || (_events = loadJson(EVENTS_FILE, []));

// Appelé par logger.log() et antispam : enregistre l'événement et rafraîchit le message (au plus 1 fois / 4 s)
function pushEvent(type, data = {}) {
  if (!TYPES[type]) return;
  const uid = data.userId || null;
  const user = uid && _client?.users.cache.get(uid);
  events().push({ t: Date.now(), type, uid, tag: data.tag || user?.username || (uid ? String(uid).slice(-6) : '?') });
  if (events().length > MAX_EVENTS) events().splice(0, events().length - MAX_EVENTS);
  saveJson(EVENTS_FILE, events());
  if (_msg && !_debounce) _debounce = setTimeout(() => { _debounce = null; refresh().catch(() => {}); }, 4000);
}

const hhmmss = t => new Date(t).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour12: false });
const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);
const ligne = (label, valeur, couleur = vert) => ' ' + gris('▸ ') + blanc(label) + ' ' + gris('·'.repeat(Math.max(2, 24 - label.length))) + ' ' + couleur(valeur);
const ping = () => Math.max(0, Math.round(_client.ws.ping));
const duree = s => { const j = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (j ? j + 'j ' : '') + String(h).padStart(2, '0') + 'h' + String(m).padStart(2, '0'); };

async function collecte() {
  const stats = await db.getStats().catch(() => ({ total: 0, present: 0, banned: 0, warned: 0 }));
  const guild = _client.guilds.cache.get(process.env.GUILD_ID) || _client.guilds.cache.first();
  const depuis = Date.now() - 24 * 3600 * 1000;
  const r24 = events().filter(e => e.t >= depuis);
  const n = type => r24.filter(e => e.type === type).length;
  const verifRole = guild?.roles.cache.get(process.env.VERIFICATION_ROLE_ID);
  let nbExpl = 0;
  try { nbExpl = require('./exploitation').getAll().filter(e => e.nom).length; } catch {}
  return {
    stats, guild, nbExpl, enCours: verifRole ? verifRole.members.size : null,
    arrivees: n('member_join'), valides: n('verification_ok') + n('member_activated'), refuses: n('verification_failed'),
    pieges: n('antispam_ban'), departs: n('member_left'), recentes: events().slice(-JOURNAL_LIGNES),
    alerte: events().some(e => ['antispam_ban', 'raid_detected', 'member_banned'].includes(e.type) && Date.now() - e.t < 10 * 60 * 1000),
  };
}

// `boot` = nombre de lignes de la section SYSTÈMES déjà « démarrées » (animation) ; null = tout affiché
async function construire(boot = null) {
  const d = await collecte();
  const nom = (d.guild?.name || 'SERVEUR').toUpperCase();
  const mode = process.env.VERIF_MODE === 'code' ? 'CODE' : process.env.VERIF_MODE === 'code-compte' ? 'CODE + COMPTE' : 'CLASSIQUE';
  const systemes = [
    ['Passerelle Discord', 'EN LIGNE · ' + ping() + ' ms', vert],
    ['Base de données', d.stats.total + ' fiches', cyan],
    ['Vérification joueurs', 'ARMÉE · ' + mode, vert],
    ...(process.env.ANTISPAM_CHANNEL_ID ? [['Anti-spam (piège)', 'ACTIF', vert]] : []),
    ['Anti-raid', 'ACTIF', vert],
    ['Système de niveaux', 'ACTIF', vert],
    ...(d.nbExpl ? [['Exploitations', String(d.nbExpl), violet]] : []),
  ];
  const visibles = boot === null ? systemes.length : Math.min(boot, systemes.length);

  const out = [];
  out.push(cyan('╔' + '═'.repeat(W - 2) + '╗'));
  out.push(cyan('║') + blanc(pad('  ◢◤ ' + nom + ' · SECURITY SYSTEM', W - 2 - 6)) + gris('v2.1  ') + cyan('║'));
  out.push(cyan('╚' + '═'.repeat(W - 2) + '╝'));
  out.push(gris(' ┌─ ') + jaune('SYSTÈMES') + gris(' ' + '─'.repeat(W - 14)));
  systemes.slice(0, visibles).forEach(([l, v, col]) => out.push(ligne(l, v, col)));
  if (visibles < systemes.length) out.push(' ' + gris('▸ ') + gris('démarrage') + jaune(' ▓▓▓░░'));

  if (boot === null) {
    out.push(gris(' ├─ ') + jaune('EN DIRECT') + gris(' ' + '─'.repeat(W - 15)));
    out.push(' ' + gris('⏱ ') + blanc('uptime ') + cyan(duree(process.uptime())) + gris('  ·  ') + blanc('ram ') + cyan(Math.round(process.memoryUsage().rss / 1048576) + ' Mo')
      + gris('  ·  ') + blanc('ping ') + cyan(ping() + ' ms'));
    out.push(' ' + gris('👥 ') + blanc('membres ') + cyan(d.guild?.memberCount ?? d.stats.total) + gris('  ·  ') + blanc('fiches présentes ') + cyan(d.stats.present)
      + gris('  ·  ') + blanc('bannis ') + rouge(d.stats.banned));
    out.push(gris(' ├─ ') + jaune('VÉRIFICATION · 24 H') + gris(' ' + '─'.repeat(W - 25)));
    out.push(' ' + cyan('➜ ' + d.arrivees) + blanc(' arrivées') + gris('   ') + vert('✔ ' + d.valides) + blanc(' validés') + gris('   ')
      + (d.enCours ? jaune('⏳ ' + d.enCours) + blanc(' en cours') : gris('⏳ 0 en cours')));
    out.push(' ' + rouge('✖ ' + d.refuses) + blanc(' refusés') + gris('   ') + rouge('☠ ' + d.pieges) + blanc(' pièges') + gris('   ') + gris('↩ ' + d.departs + ' départs'));
    out.push(gris(' └─ ') + jaune('JOURNAL') + gris(' ' + '─'.repeat(W - 13)));
    if (!d.recentes.length) out.push(' ' + gris('(aucun événement pour l\'instant)'));
    for (const e of d.recentes) {
      const [tag, col, verbe] = TYPES[e.type];
      out.push(' ' + gris(hhmmss(e.t)) + ' ' + col(tag) + ' ' + blanc(pad(e.tag, 16)) + ' ' + gris(verbe));
    }
  }

  const maj = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  return {
    embeds: [{
      title: '🛰️  CENTRE DE CONTRÔLE',
      description: '```ansi\n' + out.join('\n') + '\n```',
      color: boot !== null ? 0xF1C40F : d.alerte ? 0xE74C3C : d.enCours ? 0xE67E22 : 0x00E5FF,
      footer: { text: boot !== null ? 'démarrage en cours…' : '● en direct · actualisé toutes les 60 s · ' + maj },
    }],
  };
}

async function refresh() {
  if (!_channel) return;
  const payload = await construire();
  try {
    if (_msg) await _msg.edit(payload);
    else throw new Error('pas de message');
  } catch {
    _msg = await _channel.send(payload).catch(() => null);
    if (_msg) saveJson(MSG_FILE, { id: _msg.id });
  }
}

async function updateStatusMessage(client, animated = false) {
  if (!STATUS_CHANNEL_ID || !animated) return;
  _client = client;
  const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
  if (!channel) return;
  _channel = channel;

  // Ancien message de statut supprimé, nouveau publié (séquence de boot), puis mise à jour en direct
  const ancienId = loadJson(MSG_FILE, {}).id;
  const ancien = ancienId && await channel.messages.fetch(ancienId).catch(() => null);
  if (ancien) await ancien.delete().catch(() => {});
  if (_msg && _msg.id !== ancienId) await _msg.delete().catch(() => {});

  _msg = await channel.send(await construire(0)).catch(() => null);
  if (!_msg) return;
  saveJson(MSG_FILE, { id: _msg.id });

  for (let i = 1; i <= 7; i++) { await sleep(450); await _msg.edit(await construire(i)).catch(() => {}); }
  await sleep(500);
  await refresh();

  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => refresh().catch(() => {}), LIVE_MS);
}

module.exports = { updateStatusMessage, pushEvent };
