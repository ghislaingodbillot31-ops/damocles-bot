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

const STATUS = {
  ACTIVE:        'active',
  LEFT:          'left',
  KICKED:        'kicked',
  BANNED:        'banned',
  PENDING_ADMIN: 'pending_admin',
};

// ── Upsert membre ─────────────────────────────────────────────────────────────
function upsertMember(user, extra = {}) {
  const db  = loadDB();
  const now = new Date().toISOString();

  if (!db[user.id]) {
    db[user.id] = {
      id:       user.id,
      tag:      user.tag,
      username: user.username,
      avatar:   user.avatar || null,
      status:   STATUS.ACTIVE,
      present:  true,
      firstSeen: now,
      joinedAt:  extra.joinedAt || now,
      leftAt:    null,
      kickedAt:  null,
      bannedAt:  null,
      banReason: null,
      verifiedAt:          null,
      verificationResult:  null,
      adminAccepted:       null,
      adminAcceptedBy:     null,
      reglementAcceptedAt: null,
      firstMessageAt:      null,
      anniversaire: null,
      warnings: [],
      visits:   1,
      history:  [{ event: 'join', date: extra.joinedAt || now }],
    };
  } else {
    db[user.id].tag      = user.tag;
    db[user.id].username = user.username;
    if (user.avatar) db[user.id].avatar = user.avatar;

    // Si le membre revient
    if (!db[user.id].present) {
      db[user.id].present  = true;
      db[user.id].status   = STATUS.ACTIVE;
      db[user.id].visits   = (db[user.id].visits || 1) + 1;
      db[user.id].joinedAt = extra.joinedAt || now;
      db[user.id].leftAt   = null;
      db[user.id].history.push({ event: 'rejoin', date: extra.joinedAt || now });
    }
  }

  Object.assign(db[user.id], extra);
  saveDB(db);
  return db[user.id];
}

// ── Avertissement ─────────────────────────────────────────────────────────────
function addWarning(userId, reason, moderator) {
  const db = loadDB();
  if (!db[userId]) return null;
  const warning = { date: new Date().toISOString(), reason, moderator };
  if (!db[userId].warnings) db[userId].warnings = [];
  db[userId].warnings.push(warning);
  db[userId].history.push({ event: 'warning', date: warning.date, detail: reason, moderator });
  saveDB(db);
  return db[userId].warnings.length;
}

// ── Ban ───────────────────────────────────────────────────────────────────────
function banMember(user, reason, moderator) {
  upsertMember(user);
  const db  = loadDB();
  const now = new Date().toISOString();
  db[user.id].status    = STATUS.BANNED;
  db[user.id].present   = false;
  db[user.id].bannedAt  = now;
  db[user.id].banReason = reason;
  db[user.id].history.push({ event: 'ban', date: now, detail: reason, moderator });
  saveDB(db);
}

// ── Kick ──────────────────────────────────────────────────────────────────────
function kickMember(user, reason, moderator) {
  upsertMember(user);
  const db  = loadDB();
  const now = new Date().toISOString();
  db[user.id].status   = STATUS.KICKED;
  db[user.id].present  = false;
  db[user.id].kickedAt = now;
  db[user.id].history.push({ event: 'kick', date: now, detail: reason, moderator });
  saveDB(db);
}

// ── Départ ────────────────────────────────────────────────────────────────────
function memberLeft(user) {
  upsertMember(user);
  const db  = loadDB();
  const now = new Date().toISOString();
  db[user.id].status  = STATUS.LEFT;
  db[user.id].present = false;
  db[user.id].leftAt  = now;
  db[user.id].history.push({ event: 'leave', date: now });
  saveDB(db);
}

// ── Règlement accepté ─────────────────────────────────────────────────────────
function reglementAccepted(userId) {
  const db  = loadDB();
  if (!db[userId]) return;
  const now = new Date().toISOString();
  db[userId].reglementAcceptedAt = now;
  db[userId].status = STATUS.ACTIVE;
  db[userId].history.push({ event: 'reglement_accepted', date: now });
  saveDB(db);
}

// ── Anniversaire ──────────────────────────────────────────────────────────────
function setAnniversaire(userId, dateStr) {
  const db = loadDB();
  if (!db[userId]) return false;
  db[userId].anniversaire = dateStr;
  db[userId].history.push({ event: 'anniversaire_set', date: new Date().toISOString(), detail: dateStr });
  saveDB(db);
  return true;
}

function getAnniversairesDuMois(mois) {
  return Object.values(loadDB()).filter(m => {
    if (!m.anniversaire) return false;
    return parseInt(m.anniversaire.split('/')[1]) === mois;
  }).sort((a, b) => parseInt(a.anniversaire.split('/')[0]) - parseInt(b.anniversaire.split('/')[0]));
}

function getAnniversairesAujourdhui() {
  const today = new Date();
  return Object.values(loadDB()).filter(m => {
    if (!m.anniversaire) return false;
    const parts = m.anniversaire.split('/');
    return parseInt(parts[0]) === today.getDate() && parseInt(parts[1]) === today.getMonth() + 1;
  });
}

// ── Getters ───────────────────────────────────────────────────────────────────
function getMember(userId)  { return loadDB()[userId] || null; }
function getAllMembers()     { return Object.values(loadDB()); }

// Membres présents sur Discord
function getPresentMembers() {
  return Object.values(loadDB()).filter(m => m.present === true);
}

// Membres absents (partis, expulsés, bannis)
function getAbsentMembers() {
  return Object.values(loadDB()).filter(m => !m.present);
}

function recordActivity(userId, type) {
  const db = loadDB();
  if (!db[userId]) return;
  db[userId].history.push({ event: type, date: new Date().toISOString() });
  saveDB(db);
}

function getStats() {
  const all = getAllMembers();
  return {
    total:        all.length,
    present:      all.filter(m => m.present).length,
    absent:       all.filter(m => !m.present).length,
    active:       all.filter(m => m.status === STATUS.ACTIVE).length,
    left:         all.filter(m => m.status === STATUS.LEFT).length,
    kicked:       all.filter(m => m.status === STATUS.KICKED).length,
    banned:       all.filter(m => m.status === STATUS.BANNED).length,
    pendingAdmin: all.filter(m => m.status === STATUS.PENDING_ADMIN).length,
    warned:       all.filter(m => m.warnings?.length > 0).length,
    verified:     all.filter(m => m.verificationResult === 'ok').length,
    reglementOk:  all.filter(m => m.reglementAcceptedAt).length,
    multiVisits:  all.filter(m => (m.visits || 1) > 1).length,
  };
}

module.exports = {
  upsertMember, addWarning, banMember, kickMember, memberLeft,
  reglementAccepted, setAnniversaire, getAnniversairesDuMois,
  getAnniversairesAujourdhui, getMember, getAllMembers, getPresentMembers,
  getAbsentMembers, recordActivity, getStats, STATUS,
};
