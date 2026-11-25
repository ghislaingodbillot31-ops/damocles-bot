// Point zéro des succès : les compteurs du jeu continuent de grimper, on soustrait leur valeur au moment de la remise à zéro.
// Fichier succes-base.json : { "s|ferme|nom": v, "c|kind|ferme|fillType": v }. Absent = aucun décalage.
const fs = require('fs');
const { dataPath } = require('../core/paths');

const FILE = dataPath('succes-base.json');
let base = {};
const charger = () => { try { base = JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { base = {}; } };
charger();

const kS = (s) => `s|${s.farm}|${s.name}`;
const kC = (c) => `c|${c.kind}|${c.farm}|${c.fillType}`;

// Valeurs du jeu moins le point zéro (jamais négatif)
function appliquer(stats, counters) {
  return; // ancien niveau conservé : valeurs brutes du jeu, plus de point zéro
  for (const s of stats) s.value = Math.max(0, s.value - (base[kS(s)] || 0));
  for (const c of counters) c.value = Math.max(0, c.value - (base[kC(c)] || 0));
}

// Fige les valeurs actuelles (brutes) comme nouveau zéro
function figer(stats, counters) {
  const b = {};
  for (const s of stats) b[kS(s)] = s.value;
  for (const c of counters) b[kC(c)] = c.value;
  fs.writeFileSync(FILE, JSON.stringify(b), 'utf-8');
  charger();
}

module.exports = { appliquer, figer };
