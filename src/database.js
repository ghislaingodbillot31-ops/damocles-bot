const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'members.json');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive', LEFT: 'left', KICKED: 'kicked', BANNED: 'banned' };

// ── Upsert membre ────────────────────────────────────────────────────────────
function upsertMember(user, extra = {}) {
  const db = loadDB();
  if (!db[user.id]) {
    db[user.id] = {
      id: user.id,
      tag: user.tag,
      username: user.username,
      status: STATUS.ACTIVE,
      firstSeen: new Date().toISOString(),
      joinedAt: extra.joinedAt || new Date().toISOString(),
      lastActivity: null,
      leftAt: null,
      kickedAt: null,
      bannedAt: null,
      banReason: null,
      warnings: [],
      history: [{ event: 'join', date: new Date().toISOString() }],
    };
  } else {
    db[user.id].tag      = user.tag;
    db[user.id].username = user.username;
  }
  Object.assign(db[user.id], extra);
  saveDB(db);
  return db[user.id];
}

// ── Activité ─────────────────────────────────────────────────────────────────
function recordActivity(userId, type = 'message') {
  const db = loadDB();
  if (!db[userId]) return;
  db[userId].lastActivity = new Date().toISOString();
  db[userId].status       = STATUS.ACTIVE;
  db[userId].history.push({ event: type, date: new Date().toISOString() });
  saveDB(db);
}

// ── Avertissement ────────────────────────────────────────────────────────────
function addWarning(userId, reason, moderator) {
  const db = loadDB();
  if (!db[userId]) return null;
  const warning = { date: new Date().toISOString(), reason, moderator };
  db[userId].warnings.push(warning);
  db[userId].history.push({ event: 'warning', date: warning.date, detail: reason });
  saveDB(db);
  return db[userId].warnings.length;
}

// ── Ban ──────────────────────────────────────────────────────────────────────
function banMember(user, reason, moderator) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status    = STATUS.BANNED;
  db[user.id].bannedAt  = new Date().toISOString();
  db[user.id].banReason = reason;
  db[user.id].history.push({ event: 'ban', date: new Date().toISOString(), detail: reason, moderator });
  saveDB(db);
}

// ── Kick ─────────────────────────────────────────────────────────────────────
function kickMember(user, reason, moderator) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status   = STATUS.KICKED;
  db[user.id].kickedAt = new Date().toISOString();
  db[user.id].history.push({ event: 'kick', date: new Date().toISOString(), detail: reason, moderator });
  saveDB(db);
}

// ── Départ ───────────────────────────────────────────────────────────────────
function memberLeft(user) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status = STATUS.LEFT;
  db[user.id].leftAt = new Date().toISOString();
  db[user.id].history.push({ event: 'leave', date: new Date().toISOString() });
  saveDB(db);
}

// ── Getters ──────────────────────────────────────────────────────────────────
function getMember(userId)     { return loadDB()[userId] || null; }
function getAllMembers()        { return Object.values(loadDB()); }
function getBannedMembers()    { return getAllMembers().filter(m => m.status === STATUS.BANNED); }
function getWarnedMembers()    { return getAllMembers().filter(m => m.warnings?.length > 0); }

function getStats() {
  const all = getAllMembers();
  const now = Date.now();
  const d40 = 40 * 24 * 60 * 60 * 1000;
  return {
    total:    all.length,
    active:   all.filter(m => m.status === STATUS.ACTIVE).length,
    inactive: all.filter(m => m.status === STATUS.INACTIVE).length,
    toExpel:  all.filter(m => {
      const ref = m.lastActivity ? new Date(m.lastActivity).getTime() : new Date(m.joinedAt).getTime();
      return m.status === STATUS.INACTIVE && (now - ref) >= d40;
    }).length,
    banned:   all.filter(m => m.status === STATUS.BANNED).length,
    warned:   all.filter(m => m.warnings?.length > 0).length,
  };
}

module.exports = {
  upsertMember, recordActivity, addWarning,
  banMember, kickMember, memberLeft,
  getMember, getAllMembers, getBannedMembers, getWarnedMembers, getStats,
  STATUS,
};
