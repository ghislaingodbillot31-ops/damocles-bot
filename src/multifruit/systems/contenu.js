// Chargement et validation des fichiers de data/. Toute erreur de données est signalée au démarrage.
const fs   = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const erreurs = [];

function lire(nom) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, nom), 'utf-8')); }
  catch (e) { erreurs.push(`${nom} : ${e.message}`); return null; }
}
function indexer(nom, liste, champs) {
  const idx = {};
  if (!Array.isArray(liste)) { erreurs.push(`${nom} : doit être une liste`); return idx; }
  liste.forEach((o, i) => {
    for (const c of champs) if (o[c] === undefined) erreurs.push(`${nom}[${i}] (${o.id || '?'}) : champ « ${c} » manquant`);
    if (idx[o.id]) erreurs.push(`${nom} : id « ${o.id} » en double`);
    idx[o.id] = o;
  });
  return idx;
}

const fruits     = indexer('fruits.json',     lire('fruits.json'),     ['id', 'nom', 'emoji', 'prix_kg', 'rendement_l_par_kg', 'jus']);
const jus        = indexer('jus.json',        lire('jus.json'),        ['id', 'nom', 'emoji', 'prix_vente_l']);
const machines   = indexer('machines.json',   lire('machines.json'),   ['id', 'nom', 'emoji', 'categorie', 'prix', 'niveaux']);
const contenants = indexer('contenants.json', lire('contenants.json'), ['id', 'nom', 'emoji', 'volume_l', 'prix_unitaire', 'multiplicateur_vente']);
const cuves      = indexer('cuves.json',      lire('cuves.json'),      ['id', 'nom', 'emoji', 'capacite_l', 'prix', 'amelioration_ajout_l', 'amelioration_prix']);
const clients     = indexer('clients.json',     lire('clients.json'),     ['id', 'nom', 'emoji']);
const eq         = lire('equilibrage.json') || {};

for (const c of ['argent_depart', 'cuve_depart', 'caisse_kg', 'stock_fruits_capacite_kg', 'stock_fruits_amelioration_kg',
  'stock_fruits_amelioration_prix', 'comptoir_coef', 'comptoir_limite_l_par_jour', 'nom_entreprise_max'])
  if (eq[c] === undefined) erreurs.push(`equilibrage.json : « ${c} » manquant`);
if (!cuves[eq.cuve_depart]) erreurs.push(`equilibrage.json : cuve_depart « ${eq.cuve_depart} » inconnue`);
for (const f of Object.values(fruits)) {
  if (!jus[f.jus]) erreurs.push(`fruits.json : « ${f.id} » → jus « ${f.jus} » inconnu`);
  for (const m of f.machines_compatibles || []) if (!machines[m]) erreurs.push(`fruits.json : « ${f.id} » → machine « ${m} » inconnue`);
}
for (const m of Object.values(machines))
  (m.niveaux || []).forEach((n, i) => {
    if (n.niveau !== i + 1) erreurs.push(`machines.json : « ${m.id} » niveaux à numéroter 1, 2, 3…`);
    for (const c of ['capacite', 'duree_s']) if (n[c] === undefined) erreurs.push(`machines.json : « ${m.id} » niveau ${i + 1} sans « ${c} »`);
  });
for (const c of Object.values(contenants))
  if (c.machine_requise && !machines[c.machine_requise]) erreurs.push(`contenants.json : « ${c.id} » → machine « ${c.machine_requise} » inconnue`);

if (erreurs.length) {
  console.error('❌ Multifruit — erreurs dans les données :\n  - ' + erreurs.join('\n  - '));
  throw new Error('Multifruit : données invalides (voir ci-dessus)');
}

module.exports = { clients, fruits, jus, machines, contenants, cuves, eq };
