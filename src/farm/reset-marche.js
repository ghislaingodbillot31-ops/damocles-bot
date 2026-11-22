// Vide le marché global une seule fois (fichier témoin). Copie avant : marche.backup-reset.json.
const fs = require('fs');
const { dataPath } = require('../core/paths');

const TEMOIN = dataPath('reset-marche-1.done');

function run() {
  if (fs.existsSync(TEMOIN)) return;
  let liste = [];
  try { liste = JSON.parse(fs.readFileSync(dataPath('marche.json'), 'utf-8')); } catch {}
  fs.writeFileSync(dataPath('marche.backup-reset.json'), JSON.stringify(liste, null, 2), 'utf-8');
  fs.writeFileSync(dataPath('marche.json'), '[]', 'utf-8');
  fs.writeFileSync(TEMOIN, new Date().toISOString());
  console.log('🧹 Marché vidé : ' + liste.length + ' produit(s) (sauvegarde : marche.backup-reset.json)');
}

module.exports = { run };
