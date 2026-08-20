const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ghislaingodbillot31_db_user:Yr7iMfldJDEOLLaQ@vanguard.qgawxnd.mongodb.net/?appName=Vanguard';
const DB_NAME     = 'damocles';
const COLLECTION  = 'members';

let _client = null;
let _db     = null;

async function connect() {
  if (_db) return _db;
  _client = new MongoClient(MONGODB_URI);
  await _client.connect();
  _db = _client.db(DB_NAME);
  console.log('🍃 MongoDB connecté');
  return _db;
}

async function getCol() {
  const db = await connect();
  return db.collection(COLLECTION);
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
  const col = await getCol();
  const now = new Date().toISOString();
  const existing = await col.findOne({ id: user.id });

  if (!existing) {
    const doc = {
      id:       user.id,
      tag:      user.tag,
      username: user.username,
      avatar:   user.avatar || null,
      status:   STATUS.ACTIVE,
      present:  true,
      firstSeen:  now,
      joinedAt:   extra.joinedAt || now,
      leftAt:     null, kickedAt: null, bannedAt: null, banReason: null,
      verifiedAt: null, verificationResult: null,
      adminAccepted: null, adminAcceptedBy: null,
      reglementAcceptedAt: null, firstMessageAt: null,
      anniversaire: null,
      warnings: [],
      visits:   1,
      history:  [{ event: 'join', date: extra.joinedAt || now }],
      ...extra,
    };
    await col.insertOne(doc);
    return doc;
  } else {
    const update = {
      tag:      user.tag,
      username: user.username,
    };
    if (user.avatar) update.avatar = user.avatar;

    if (!existing.present) {
      update.present  = true;
      update.status   = STATUS.ACTIVE;
      update.visits   = (existing.visits || 1) + 1;
      update.joinedAt = extra.joinedAt || now;
      update.leftAt   = null;
      await col.updateOne({ id: user.id }, {
        $set: update,
        $push: { history: { event: 'rejoin', date: extra.joinedAt || now } },
      });
    } else {
      if (extra && Object.keys(extra).length) Object.assign(update, extra);
      await col.updateOne({ id: user.id }, { $set: update });
    }
    return await col.findOne({ id: user.id });
  }
}

// ── Avertissement ─────────────────────────────────────────────────────────────
async function addWarning(userId, reason, moderator) {
  const col     = await getCol();
  const warning = { date: new Date().toISOString(), reason, moderator };
  await col.updateOne({ id: userId }, {
    $push: { warnings: warning, history: { event: 'warning', date: warning.date, detail: reason, moderator } },
  });
  const m = await col.findOne({ id: userId });
  return m?.warnings?.length || 0;
}

// ── Ban ───────────────────────────────────────────────────────────────────────
async function banMember(user, reason, moderator) {
  await upsertMember(user);
  const col = await getCol();
  const now = new Date().toISOString();
  await col.updateOne({ id: user.id }, {
    $set: { status: STATUS.BANNED, present: false, bannedAt: now, banReason: reason },
    $push: { history: { event: 'ban', date: now, detail: reason, moderator } },
  });
}

// ── Kick ──────────────────────────────────────────────────────────────────────
async function kickMember(user, reason, moderator) {
  await upsertMember(user);
  const col = await getCol();
  const now = new Date().toISOString();
  await col.updateOne({ id: user.id }, {
    $set: { status: STATUS.KICKED, present: false, kickedAt: now },
    $push: { history: { event: 'kick', date: now, detail: reason, moderator } },
  });
}

// ── Départ ────────────────────────────────────────────────────────────────────
async function memberLeft(user) {
  await upsertMember(user);
  const col = await getCol();
  const now = new Date().toISOString();
  await col.updateOne({ id: user.id }, {
    $set: { status: STATUS.LEFT, present: false, leftAt: now },
    $push: { history: { event: 'leave', date: now } },
  });
}

// ── Règlement accepté ─────────────────────────────────────────────────────────
async function reglementAccepted(userId) {
  const col = await getCol();
  const now = new Date().toISOString();
  await col.updateOne({ id: userId }, {
    $set: { reglementAcceptedAt: now, status: STATUS.ACTIVE },
    $push: { history: { event: 'reglement_accepted', date: now } },
  });
}

// ── Anniversaire ──────────────────────────────────────────────────────────────
async function setAnniversaire(userId, dateStr) {
  const col = await getCol();
  const m   = await col.findOne({ id: userId });
  if (!m) return false;
  await col.updateOne({ id: userId }, {
    $set: { anniversaire: dateStr },
    $push: { history: { event: 'anniversaire_set', date: new Date().toISOString(), detail: dateStr } },
  });
  return true;
}

async function getAnniversairesDuMois(mois) {
  const col  = await getCol();
  const all  = await col.find({ anniversaire: { $ne: null } }).toArray();
  return all.filter(m => parseInt(m.anniversaire?.split('/')[1]) === mois)
            .sort((a, b) => parseInt(a.anniversaire.split('/')[0]) - parseInt(b.anniversaire.split('/')[0]));
}

async function getAnniversairesAujourdhui() {
  const today = new Date();
  const col   = await getCol();
  const all   = await col.find({ anniversaire: { $ne: null } }).toArray();
  return all.filter(m => {
    const parts = m.anniversaire?.split('/');
    return parts && parseInt(parts[0]) === today.getDate() && parseInt(parts[1]) === today.getMonth() + 1;
  });
}

// ── Getters ───────────────────────────────────────────────────────────────────
async function getMember(userId) {
  const col = await getCol();
  return await col.findOne({ id: userId });
}

async function getAllMembers() {
  const col = await getCol();
  return await col.find({}).toArray();
}

async function getPresentMembers() {
  const col = await getCol();
  return await col.find({ present: true }).toArray();
}

async function getAbsentMembers() {
  const col = await getCol();
  return await col.find({ present: false }).toArray();
}

async function recordActivity(userId, type) {
  const col = await getCol();
  await col.updateOne({ id: userId }, {
    $push: { history: { event: type, date: new Date().toISOString() } },
  });
}

async function getStats() {
  const col = await getCol();
  const all = await col.find({}).toArray();
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
  connect, upsertMember, addWarning, banMember, kickMember, memberLeft,
  reglementAccepted, setAnniversaire, getAnniversairesDuMois,
  getAnniversairesAujourdhui, getMember, getAllMembers, getPresentMembers,
  getAbsentMembers, recordActivity, getStats, STATUS,
};
