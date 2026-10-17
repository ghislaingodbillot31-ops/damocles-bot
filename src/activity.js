// Détection d'inactivité des membres.
// L'ancien système scannait l'historique des messages ; il n'existe plus.
// On se base désormais sur la DB : dernière trace connue d'un membre =
// son premier message, l'acceptation du règlement, ou le dernier évènement
// de son historique (rejoin, warning, etc.). À défaut : sa date d'arrivée.

const config = require('./config');
const db     = require('./database');

const DAY_MS = 86_400_000;

function thresholds() {
  const cfg = config.get();
  const inactiveDays = Number(cfg.INACTIVE_DAYS) || 15;
  const expelDays    = Number(cfg.EXPEL_DAYS)    || 40;
  return { inactiveDays, expelDays, inactiveMs: inactiveDays * DAY_MS, expelMs: expelDays * DAY_MS };
}

const { inactiveDays: INACTIVE_DAYS, expelDays: EXPEL_DAYS } = thresholds();

// id -> dernier timestamp d'activité connu (ms). Rafraîchi via refresh().
let _lastSeen = new Map();

// Reconstruit le cache depuis la DB. À appeler avant une passe d'analyse.
async function refresh() {
  const all = await db.getAllMembers();
  const map = new Map();

  for (const m of all) {
    const dates = [];
    if (m.firstMessageAt)      dates.push(Date.parse(m.firstMessageAt));
    if (m.reglementAcceptedAt) dates.push(Date.parse(m.reglementAcceptedAt));
    if (Array.isArray(m.history)) {
      for (const h of m.history) if (h && h.date) dates.push(Date.parse(h.date));
    }
    const valid = dates.filter(Number.isFinite);
    if (valid.length) map.set(m.id, Math.max(...valid));
  }

  _lastSeen = map;
  return map.size;
}

function getLastActivity(userId) {
  return _lastSeen.get(userId) || null;
}

// member = GuildMember Discord
function getMemberStatus(member) {
  const { inactiveMs, expelMs } = thresholds();
  const now      = Date.now();
  const last     = _lastSeen.get(member.id);
  const joinedMs = member.joinedTimestamp || now;

  if ((now - joinedMs) < inactiveMs) return 'new';
  if (last && (now - last) < inactiveMs) return 'active';

  const ref = last != null ? last : joinedMs;
  if ((now - ref) >= expelMs)    return 'expel';
  if ((now - ref) >= inactiveMs) return 'inactive';
  return 'active';
}

function getDaysInactive(member) {
  const last = _lastSeen.get(member.id);
  const ref  = last != null ? last : (member.joinedTimestamp || Date.now());
  return Math.max(0, Math.floor((Date.now() - ref) / DAY_MS));
}

module.exports = {
  refresh, getLastActivity, getMemberStatus, getDaysInactive,
  INACTIVE_DAYS, EXPEL_DAYS,
};
