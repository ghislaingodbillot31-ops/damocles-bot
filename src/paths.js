const fs   = require('fs');
const path = require('path');

// Dossier des données. En local : <projet>/data.
// Sur Render : mettre la variable d'env DATA_DIR sur le point de montage du
// disque persistant (ex. /var/data) → les fichiers survivent aux redéploiements.
const REPO_DATA = path.join(__dirname, '..', 'data');
const DATA_DIR  = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : REPO_DATA;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// Premier montage d'un disque persistant vide : on y recopie TOUS les fichiers
// présents dans le data/ du dépôt (et le sous-dossier images/) pour ne pas
// repartir de zéro. Un fichier déjà sur le disque n'est jamais écrasé.
if (DATA_DIR !== REPO_DATA) {
  const copierDossier = (srcDir, dstDir) => {
    let entries = [];
    try { entries = fs.readdirSync(srcDir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const src = path.join(srcDir, e.name);
      const dst = path.join(dstDir, e.name);
      try {
        if (e.isDirectory()) {
          fs.mkdirSync(dst, { recursive: true });
          copierDossier(src, dst);
        } else if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          console.log('📦 Copie initiale ' + path.relative(REPO_DATA, src) + ' → ' + DATA_DIR);
        }
      } catch (err) {
        console.error('⚠️ paths — copie ' + e.name + ' :', err.message);
      }
    }
  };
  copierDossier(REPO_DATA, DATA_DIR);
}

// Récap au démarrage
try {
  const fichiers = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  console.log('💾 Stockage : ' + DATA_DIR + (DATA_DIR === REPO_DATA ? ' (local)' : ' (disque persistant)')
    + ' — ' + fichiers.length + ' fichier(s)');
} catch {}

function dataPath(name) { return path.join(DATA_DIR, name); }

module.exports = { DATA_DIR, REPO_DATA, dataPath };
