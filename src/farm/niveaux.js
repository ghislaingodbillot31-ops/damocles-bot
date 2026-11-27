const fs = require('fs');
const { dataPath } = require('../core/paths');
const C = require('./niveaux-config');
const SERIES = require('./fs25-succes-config');

// Niveaux des fermes du jeu (clé = id de la ferme FS25).
// Le niveau et le score gardés ne baissent jamais, même si une statistique du jeu diminue.
const PATH = dataPath('niveaux.json');
// { farms: { id: { nom, score, niveau } }, hub: { head, farms: { id: { msgId, h } }, foret } }
let db = { farms: {}, hub: { head: null, farms: {}, foret: null } };
try { db = { ...db, ...JSON.parse(fs.readFileSync(PATH, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(PATH, JSON.stringify(db, null, 2), 'utf-8'); } catch {} };

const estForet = farm => farm.name.trim().toLowerCase() === C.FORET;

// Somme des niveaux de succès débloqués par la ferme (36 séries de 100 niveaux, Apiculteur 5)
function score(farm, status) {
  const { seriesValue, tiersReached } = require('./fs25-succes');
  return SERIES.reduce((n, s) => { const v = seriesValue(s, farm.id, status); return n + (v === null ? 0 : tiersReached(s, v)); }, 0);
}
const niveauDe = sc => C.PALIERS.filter(p => sc >= p).length;

const lire = farm => db.farms[farm.id] || { nom: farm.name, score: 0, niveau: 1 };
function fiche(farm) {
  return db.farms[farm.id] ||= { nom: farm.name, score: 0, niveau: 1 };
}

// Recalcule score et niveau de toutes les fermes. Renvoie les montées de niveau.
// Une ferme vue pour la première fois est enregistrée sans annonce.
// Barème des succès : en changer le nom recalcule UNE fois le score et le niveau de toutes les fermes (sans annonce)
const BAREME = 'paliers-2026-11-100niv';

function actualiser(status) {
  const montees = [];
  const recalcul = db.bareme !== BAREME && status.stats?.length > 0;
  for (const farm of status.farms) {
    if (estForet(farm)) continue;
    const neuf = !db.farms[farm.id];
    const f = fiche(farm);
    f.nom = farm.name;
    if (recalcul) { f.score = score(farm, status); f.niveau = niveauDe(f.score) || 1; continue; }
    f.score = Math.max(f.score, score(farm, status));
    const niv = Math.max(f.niveau, niveauDe(f.score));
    if (niv > f.niveau && !neuf) montees.push({ farm, de: f.niveau, a: niv });
    f.niveau = niv;
  }
  if (recalcul) {
    // L'ancien barème (25 niveaux) reste sur le disque, une seule fois
    try { const b = dataPath('niveaux.backup-bareme-25.json'); if (!fs.existsSync(b)) fs.writeFileSync(b, JSON.stringify(db, null, 2), 'utf-8'); } catch {}
    db.bareme = BAREME;
  }
  save();
  return montees;
}

// Classement : niveau puis score
const classement = status => status.farms.filter(f => !estForet(f))
  .map(farm => ({ farm, f: lire(farm) }))
  .sort((a, b) => b.f.niveau - a.f.niveau || b.f.score - a.f.score || a.farm.name.localeCompare(b.farm.name, 'fr'));

// Les paliers ont changé (dashboard) : score et niveau de toutes les fermes recalculés au prochain passage
const forcerRecalcul = () => { db.bareme = null; save(); };

module.exports = { forcerRecalcul, db: () => db, save, estForet, fiche, lire, actualiser, classement, niveauDe };
