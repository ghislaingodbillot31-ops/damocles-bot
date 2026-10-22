// Base SQLite propre à Multifruit (node:sqlite, intégré à Node : aucune dépendance).
// Fichier : <DATA_DIR>/multifruit/multifruit.db — séparé du reste du bot.
const fs   = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { dataPath } = require('../../paths');

const FICHIER = dataPath(path.join('multifruit', 'multifruit.db'));
fs.mkdirSync(path.dirname(FICHIER), { recursive: true });

const db = new DatabaseSync(FICHIER);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS multifruit_config (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS multifruit_entreprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL COLLATE NOCASE UNIQUE,
  pieces REAL NOT NULL,
  capacite_fruits_kg REAL NOT NULL,
  date_creation INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS multifruit_stock_fruits (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  fruit_id TEXT NOT NULL,
  kg REAL NOT NULL DEFAULT 0 CHECK (kg >= 0),
  PRIMARY KEY (entreprise_id, fruit_id)
);
CREATE TABLE IF NOT EXISTS multifruit_machines (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  machine_id TEXT NOT NULL,
  niveau INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entreprise_id, machine_id)
);
CREATE TABLE IF NOT EXISTS multifruit_cuves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  type_cuve TEXT NOT NULL,
  capacite_l REAL NOT NULL,
  jus_id TEXT,
  volume_l REAL NOT NULL DEFAULT 0 CHECK (volume_l >= 0),
  reserve_l REAL NOT NULL DEFAULT 0 CHECK (reserve_l >= 0)
);
CREATE TABLE IF NOT EXISTS multifruit_stock_contenants (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  contenant_id TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
  PRIMARY KEY (entreprise_id, contenant_id)
);
CREATE TABLE IF NOT EXISTS multifruit_produits_finis (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  jus_id TEXT NOT NULL,
  contenant_id TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
  PRIMARY KEY (entreprise_id, jus_id, contenant_id)
);
CREATE TABLE IF NOT EXISTS multifruit_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  type TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  entrees TEXT NOT NULL,
  sorties TEXT NOT NULL,
  debut INTEGER NOT NULL,
  fin INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours'
);
CREATE TABLE IF NOT EXISTS multifruit_ventes_jour (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  jour TEXT NOT NULL,
  litres REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (entreprise_id, jour)
);
CREATE TABLE IF NOT EXISTS multifruit_stats (
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  cle TEXT NOT NULL,
  valeur REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (entreprise_id, cle)
);
CREATE TABLE IF NOT EXISTS multifruit_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entreprise_id INTEGER NOT NULL,
  date INTEGER NOT NULL,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  montant REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS multifruit_bons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL, jus_id TEXT NOT NULL, contenant_id TEXT NOT NULL,
  quantite INTEGER NOT NULL, prix_total REAL NOT NULL, cree INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS multifruit_commandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entreprise_id INTEGER NOT NULL REFERENCES multifruit_entreprises(id),
  client_id TEXT NOT NULL, jus_id TEXT NOT NULL, contenant_id TEXT NOT NULL,
  quantite INTEGER NOT NULL, prix_total REAL NOT NULL, echeance INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours'
);
`);

// Première création de multifruit_stats : reconstitue les totaux déjà joués à partir du journal.
if (!db.prepare('SELECT 1 FROM multifruit_stats LIMIT 1').get()) {
  const cumul = {};
  const add = (id, cle, v) => { cumul[id + '|' + cle] = (cumul[id + '|' + cle] || 0) + v; };
  for (const j of db.prepare("SELECT * FROM multifruit_journal WHERE type IN ('pressage','embouteillage','vente_comptoir')").all()) {
    if (j.type === 'pressage') { const m = j.detail.match(/^([\d.]+) kg \S+ → ([\d.]+) L$/); if (m) { add(j.entreprise_id, 'fruits_presses_kg', +m[1]); add(j.entreprise_id, 'jus_presse_l', +m[2]); } }
    else { const m = j.detail.match(/^(\d+) /); if (m) add(j.entreprise_id, j.type === 'embouteillage' ? 'bouteilles_generees' : 'bouteilles_vendues', +m[1]); }
  }
  const ins = db.prepare('INSERT INTO multifruit_stats (entreprise_id, cle, valeur) VALUES (?,?,?)');
  for (const [k, v] of Object.entries(cumul)) { const [id, cle] = k.split('|'); ins.run(Number(id), cle, Math.round(v * 100) / 100); }
}

// Exécute fn dans une transaction : tout passe ou rien (une erreur annule tout).
// Synchrone → aucune autre action ne s'intercale, donc un double clic voit déjà l'état à jour.
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, transaction, FICHIER };
