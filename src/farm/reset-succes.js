// Remise à zéro ponctuelle des succès de toutes les exploitations (une seule fois, repérée par un fichier témoin).
// Sauvegarde d'abord (succes.backup-reset.json : compteurs du jeu + niveaux), puis fige les compteurs actuels comme zéro
// et remet score/niveau de chaque ferme à zéro (activités et usines conservées).
const fs = require('fs');
const { dataPath } = require('../core/paths');

const TEMOIN = dataPath('reset-succes-1.done');

async function run(client) {
  if (fs.existsSync(TEMOIN)) return;
  const bridge = require('./fs25-bridge');
  const niveaux = require('./niveaux');
  const brut = await bridge.lireStatutBrut();
  if (!brut.stats.length) { console.warn('[FS25] Reset succès reporté : aucune statistique lue'); return; }
  try {
    fs.writeFileSync(dataPath('succes.backup-reset.json'), JSON.stringify({ date: new Date().toISOString(), farms: brut.farms, stats: brut.stats, counters: brut.counters, niveaux: niveaux.db().farms }, null, 2), 'utf-8');
  } catch (e) { console.error('⚠️ Sauvegarde succès :', e.message); return; }

  require('./succes-base').figer(brut.stats, brut.counters);
  for (const f of Object.values(niveaux.db().farms)) { f.score = 0; f.niveau = 1; }
  niveaux.save();
  fs.writeFileSync(TEMOIN, new Date().toISOString());
  console.log('🧹 Succès remis à zéro pour ' + brut.farms.length + ' ferme(s) (sauvegarde : succes.backup-reset.json)');

  // Rafraîchit uniquement le salon des succès : mémoire vidée, relevé neuf (silencieux), salon vidé puis HUB republié
  const succes = require('./fs25-succes');
  succes._reset();
  const ch = await client.channels.fetch(process.env.FS25_SUCCES_CHANNEL_ID).catch(() => null);
  await succes.processAchievements(await bridge.lireStatutUneFois(), ch).catch(() => {});
  if (ch) await succes.resetSalon(ch).catch(() => {});
}

module.exports = { run };
