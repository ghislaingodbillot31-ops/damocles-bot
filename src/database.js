const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'members.json');
const USE_MONGO = !!process.env.MONGODB_URI && process.env.NODE_ENV !== 'local';

let _col = null;

// ── Initialisation MongoDB si dispo ──────────────────────────────────────────
async function initMongo() {
  if (!process.env.MONGODB_URI) return false;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    _col = client.db('damocles').collection('members');
    console.log('🍃 MongoDB connecté');
    return true;
  } catch (err) {
    console.log('⚠️ MongoDB indisponible — utilisation JSON local :', err.message);
    _col = null;
    return false;
  }
}

// ── JSON local ────────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveDB(db) {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
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
async function upsertMember(user, extra = {}) {
  const now = new Date().toISOString();

  if (_col) {
    const existing = await _col.findOne({ id: user.id });
    if (!existing) {
      const doc = {
        id: user.id, tag: user.tag, username: user.username,
        avatar: user.avatar || null, status: STATUS.ACTIVE, present: true,
        firstSeen: now, joinedAt: extra.joinedAt || now,
        leftAt: null, kickedAt: null, bannedAt: null, banReason: null,
        verifiedAt: null, verificationResult: null,
        adminAccepted: null, adminAcceptedBy: null,
        reglementAcceptedAt: null, firstMessageAt: null,
        anniversaire: null, warnings: [], visits: 1,
        history: [{ event: 'join', date: extra.joinedAt || now }],
        ...extra,
      };
      await _col.insertOne(doc);
      return doc;
    } else {
      const update = { tag: user.tag, username: user.username };
      if (user.avatar) update.avatar = user.avatar;
      if (!existing.present) {
        update.present = true; update.status = STATUS.ACTIVE;
        update.visits = (existing.visits || 1) + 1;
        update.joinedAt = extra.joinedAt || now; update.leftAt = null;
        await _col.updateOne({ id: user.id }, {
          $set: update, $push: { history: { event: 'rejoin', date: now } }
        });
      } else {
        if (extra) Object.assign(update, extra);
        await _col.updateOne({ id: user.id }, { $set: update });
      }
      return await _col.findOne({ id: user.id });
    }
  }

  // JSON local
  const db = loadDB();
  if (!db[user.id]) {
    db[user.id] = {
      id: user.id, tag: user.tag, username: user.username,
      avatar: user.avatar || null, status: STATUS.ACTIVE, present: true,
      firstSeen: now, joinedAt: extra.joinedAt || now,
      leftAt: null, kickedAt: null, bannedAt: null, banReason: null,
      verifiedAt: null, verificationResult: null,
      adminAccepted: null, adminAcceptedBy: null,
      reglementAcceptedAt: null, firstMessageAt: null,
      anniversaire: null, warnings: [], visits: 1,
      history: [{ event: 'join', date: extra.joinedAt || now }],
    };
  } else {
    db[user.id].tag = user.tag; db[user.id].username = user.username;
    if (!db[user.id].present) {
      db[user.id].present = true; db[user.id].status = STATUS.ACTIVE;
      db[user.id].visits = (db[user.id].visits || 1) + 1;
      db[user.id].joinedAt = extra.joinedAt || now; db[user.id].leftAt = null;
      db[user.id].history.push({ event: 'rejoin', date: now });
    }
  }
  if (extra) Object.assign(db[user.id], extra);
  saveDB(db);
  return db[user.id];
}

// ── Helpers CRUD ──────────────────────────────────────────────────────────────
async function updateMember(userId, set, push) {
  if (_col) {
    const ops = {};
    if (set)  ops.$set  = set;
    if (push) ops.$push = push;
    await _col.updateOne({ id: userId }, ops);
  } else {
    const db = loadDB();
    if (!db[userId]) return;
    if (set)  Object.assign(db[userId], set);
    if (push) {
      for (const [key, val] of Object.entries(push)) {
        if (!db[userId][key]) db[userId][key] = [];
        db[userId][key].push(val);
      }
    }
    saveDB(db);
  }
}

async function addWarning(userId, reason, moderator) {
  const warning = { date: new Date().toISOString(), reason, moderator };
  await updateMember(userId, null, { warnings: warning, history: { event: 'warning', date: warning.date, detail: reason, moderator } });
  const m = await getMember(userId);
  return m?.warnings?.length || 0;
}

async function banMember(user, reason, moderator) {
  await upsertMember(user);
  const now = new Date().toISOString();
  await updateMember(user.id,
    { status: STATUS.BANNED, present: false, bannedAt: now, banReason: reason },
    { history: { event: 'ban', date: now, detail: reason, moderator } }
  );
}

async function kickMember(user, reason, moderator) {
  await upsertMember(user);
  const now = new Date().toISOString();
  await updateMember(user.id,
    { status: STATUS.KICKED, present: false, kickedAt: now },
    { history: { event: 'kick', date: now, detail: reason, moderator } }
  );
}

async function memberLeft(user) {
  await upsertMember(user);
  const now = new Date().toISOString();
  await updateMember(user.id,
    { status: STATUS.LEFT, present: false, leftAt: now },
    { history: { event: 'leave', date: now } }
  );
}

async function reglementAccepted(userId) {
  const now = new Date().toISOString();
  await updateMember(userId,
    { reglementAcceptedAt: now, status: STATUS.ACTIVE },
    { history: { event: 'reglement_accepted', date: now } }
  );
}

async function setAnniversaire(userId, dateStr) {
  const m = await getMember(userId);
  if (!m) return false;
  await updateMember(userId,
    { anniversaire: dateStr },
    { history: { event: 'anniversaire_set', date: new Date().toISOString(), detail: dateStr } }
  );
  return true;
}

// ── Getters ───────────────────────────────────────────────────────────────────
async function getMember(userId) {
  if (_col) return await _col.findOne({ id: userId });
  return loadDB()[userId] || null;
}

async function getAllMembers() {
  if (_col) return await _col.find({}).toArray();
  return Object.values(loadDB());
}

async function getPresentMembers() {
  if (_col) return await _col.find({ present: true }).toArray();
  return Object.values(loadDB()).filter(m => m.present);
}

async function getAbsentMembers() {
  if (_col) return await _col.find({ present: false }).toArray();
  return Object.values(loadDB()).filter(m => !m.present);
}

async function recordActivity(userId, type) {
  await updateMember(userId, null, { history: { event: type, date: new Date().toISOString() } });
}

async function getAnniversairesDuMois(mois) {
  const all = await getAllMembers();
  return all.filter(m => m.anniversaire && parseInt(m.anniversaire.split('/')[1]) === mois)
            .sort((a, b) => parseInt(a.anniversaire.split('/')[0]) - parseInt(b.anniversaire.split('/')[0]));
}

async function getAnniversairesAujourdhui() {
  const today = new Date();
  const all   = await getAllMembers();
  return all.filter(m => {
    if (!m.anniversaire) return false;
    const p = m.anniversaire.split('/');
    return parseInt(p[0]) === today.getDate() && parseInt(p[1]) === today.getMonth() + 1;
  });
}

async function getStats() {
  const all = await getAllMembers();
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
  initMongo, upsertMember, addWarning, banMember, kickMember, memberLeft,
  reglementAccepted, setAnniversaire, getAnniversairesDuMois,
  getAnniversairesAujourdhui, getMember, getAllMembers, getPresentMembers,
  getAbsentMembers, recordActivity, getStats, STATUS,
};
