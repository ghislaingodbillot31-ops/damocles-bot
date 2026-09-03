const fs   = require('fs');
const path = require('path');

// Dossier des données. En local : <projet>/data.
// Sur Render : mettre la variable d'env DATA_DIR sur le point de montage du
// disque persistant (ex. /var/data) → les fichiers survivent aux redéploiements.
const REPO_DATA = path.join(__dirname, '..', 'data');
const DATA_DIR  = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : REPO_DATA;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// Premier montage d'un disque persistant vide : on y recopie les fichiers de
// base versionnés dans le dépôt pour ne pas repartir de zéro.
if (DATA_DIR !== REPO_DATA) {
  for (const f of ['members.json', 'exploitations.json', 'config.json', 'welcome-config.json']) {
    const dst = path.join(DATA_DIR, f);
    const src = path.join(REPO_DATA, f);
    try {
      if (!fs.existsSync(dst) && fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log('📦 Copie initiale ' + f + ' → ' + DATA_DIR);
      }
    } catch (e) {
      console.error('⚠️ paths — copie initiale ' + f + ' :', e.message);
    }
  }
}

function dataPath(name) { return path.join(DATA_DIR, name); }

module.exports = { DATA_DIR, REPO_DATA, dataPath };
