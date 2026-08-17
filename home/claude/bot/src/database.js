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
  const db = loadDB();
  const now = new Date().toISOString();

  if (!db[user.id]) {
    db[user.id] = {
      id:         user.id,
      tag:        user.tag,
      username:   user.username,
      status:     STATUS.ACTIVE,
      firstSeen:  now,
      joinedAt:   extra.joinedAt || now,
      leftAt:     null,
      kickedAt:   null,
      bannedAt:   null,
      banReason:  null,
      warnings:   [],
      // Vérification
      verifiedAt:          null,
      verificationResult:  null,
      verificationChecks:  null,
      adminAccepted:       null,
      adminAcceptedBy:     null,
      adminAcceptedAt:     null,
      // Règlement
      reglementAcceptedAt: null,
      // Historique complet
      history: [{ event: 'join', date: now }],
      // Stats visites
      visits: 1,
    };
  } else {
    // Mise à jour infos de base
    db[user.id].tag      = user.tag;
    db[user.id].username = user.username;

    // Si le membre revient (was left/kicked)
    if (['left', 'kicked'].includes(db[user.id].status)) {
      db[user.id].visits = (db[user.id].visits || 1) + 1;
      db[user.id].status = STATUS.ACTIVE;
      db[user.id].history.push({ event: 'rejoin', date: now });
    }
  }

  // Appliquer les extras
  Object.assign(db[user.id], extra);
  saveDB(db);
  return db[user.id];
}

// ── Avertissement ─────────────────────────────────────────────────────────────
function addWarning(userId, reason, moderator) {
  const db = loadDB();
  if (!db[userId]) return null;
  const warning = { date: new Date().toISOString(), reason, moderator };
  db[userId].warnings.push(warning);
  db[userId].history.push({ event: 'warning', date: warning.date, detail: reason, moderator });
  saveDB(db);
  return db[userId].warnings.length;
}

// ── Ban ───────────────────────────────────────────────────────────────────────
function banMember(user, reason, moderator) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status    = STATUS.BANNED;
  db[user.id].bannedAt  = new Date().toISOString();
  db[user.id].banReason = reason;
  db[user.id].history.push({ event: 'ban', date: new Date().toISOString(), detail: reason, moderator });
  saveDB(db);
}

// ── Kick ──────────────────────────────────────────────────────────────────────
function kickMember(user, reason, moderator) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status   = STATUS.KICKED;
  db[user.id].kickedAt = new Date().toISOString();
  db[user.id].history.push({ event: 'kick', date: new Date().toISOString(), detail: reason, moderator });
  saveDB(db);
}

// ── Départ ────────────────────────────────────────────────────────────────────
function memberLeft(user) {
  upsertMember(user);
  const db = loadDB();
  db[user.id].status = STATUS.LEFT;
  db[user.id].leftAt = new Date().toISOString();
  db[user.id].history.push({ event: 'leave', date: new Date().toISOString() });
  saveDB(db);
}

// ── Règlement accepté ─────────────────────────────────────────────────────────
function reglementAccepted(userId) {
  const db = loadDB();
  if (!db[userId]) return;
  db[userId].reglementAcceptedAt = new Date().toISOString();
  db[userId].status = STATUS.ACTIVE;
  db[userId].history.push({ event: 'reglement_accepted', date: new Date().toISOString() });
  saveDB(db);
}

// ── Getters ───────────────────────────────────────────────────────────────────
function getMember(userId)  { return loadDB()[userId] || null; }
function getAllMembers()     { return Object.values(loadDB()); }

function getStats() {
  const all = getAllMembers();
  return {
    total:        all.length,
    active:       all.filter(m => m.status === STATUS.ACTIVE).length,
    left:         all.filter(m => m.status === STATUS.LEFT).length,
    kicked:       all.filter(m => m.status === STATUS.KICKED).length,
    banned:       all.filter(m => m.status === STATUS.BANNED).length,
    pendingAdmin: all.filter(m => m.status === STATUS.PENDING_ADMIN).length,
    warned:       all.filter(m => m.warnings?.length > 0).length,
    verified:     all.filter(m => m.verificationResult === 'ok').length,
    rejected:     all.filter(m => m.verificationResult === 'failed').length,
    reglementOk:  all.filter(m => m.reglementAcceptedAt).length,
    multiVisits:  all.filter(m => (m.visits || 1) > 1).length,
  };
}

module.exports = {
  upsertMember, addWarning, banMember, kickMember, memberLeft, reglementAccepted,
  getMember, getAllMembers, getStats, STATUS,
};
