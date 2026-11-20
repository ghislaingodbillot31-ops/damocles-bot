// Réglages des paliers de succès faits depuis le dashboard (onglet « Succès »).
// Fichier succes-paliers.json : { idSuccès: { pas, sup } }. Niveau n = pas × n + sup × n(n-1)/2, le nombre de niveaux de la série est conservé.
// Sans réglage, la série garde les paliers définis dans fs25-succes-config.js.
const fs = require('fs');
const { dataPath } = require('../core/paths');

const FILE = dataPath('succes-paliers.json');
let reglages = {};
try { reglages = JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch {}

let series = [];
const defauts = {}; // id -> paliers d'origine (config)

const calcul = (pas, sup, nb) => Array.from({ length: nb }, (_, i) => +(pas * (i + 1) + (sup * i * (i + 1)) / 2).toFixed(4));

// Remplace le contenu du tableau « tiers » sur place : les autres modules gardent la même référence
function appliquer(s) {
  const r = reglages[s.id];
  const t = r && r.pas > 0 ? calcul(r.pas, r.sup || 0, defauts[s.id].length) : defauts[s.id];
  s.tiers.splice(0, s.tiers.length, ...t);
}

function init(liste) {
  series = liste;
  for (const s of series) { defauts[s.id] = [...s.tiers]; appliquer(s); }
}

const liste = () => series.map(s => ({
  id: s.id, categorie: s.category, emoji: s.emoji, nom: s.name, unite: s.unit,
  tiers: s.tiers, defaut: defauts[s.id], reglage: reglages[s.id] || null,
}));

// pas vide ou 0 = retour aux paliers d'origine. Les niveaux des exploitations sont recalculés au prochain passage.
function regler(id, pas, sup) {
  const s = series.find(x => x.id === id);
  if (!s) throw new Error('Succès inconnu');
  pas = Number(pas); sup = Number(sup) || 0;
  if (pas > 0) reglages[id] = { pas, sup: sup > 0 ? sup : 0 }; else delete reglages[id];
  fs.writeFileSync(FILE, JSON.stringify(reglages, null, 2), 'utf-8');
  appliquer(s);
  require('./niveaux').forcerRecalcul();
  return liste().find(x => x.id === id);
}

module.exports = { init, liste, regler };
