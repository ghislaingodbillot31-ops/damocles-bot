// Redémarrage complet quotidien du bot.
//
// L'heure (Paris) se règle dans le dashboard, page Configuration (RESTART_HOUR,
// vide = désactivé). Elle est relue chaque heure : un changement s'applique sans
// redéployer.
//
// Deux façons de redémarrer :
//  1. RENDER_API_KEY défini (RENDER_SERVICE_ID est fourni par Render) : on demande
//     à Render un vrai redémarrage du service, comme le bouton « Restart » du
//     tableau de bord Render. Render envoie ensuite SIGTERM au bot.
//  2. Sinon : arrêt propre du process, que Render relance aussitôt.
// Dans les deux cas l'arrêt passe par SIGTERM → levels.js sauvegarde l'XP avant de quitter.
const config = require('./config');

let _client = null;
let _enCours = false;

function heureParis() {
  return +new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hour12: false, timeZone: 'Europe/Paris' }).format(new Date());
}

function heureReglee() {
  const h = config.get().RESTART_HOUR;
  if (h === '' || h === null || h === undefined) return null;
  const n = parseInt(h, 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
}

async function prevenir(texte) {
  try {
    const id = process.env.DAMOCLES_LOG_CHANNEL_ID;
    const ch = id && _client?.channels.cache.get(id);
    if (ch) await ch.send({ embeds: [{ description: '`▶` 🔄 ' + texte, color: 0x95A5A6 }] });
  } catch {}
}

async function arretPropre() {
  try { await _client?.destroy(); } catch {}
  // Déclenche les gestionnaires existants (sauvegarde XP puis exit), sinon quitte nous-mêmes.
  if (process.listenerCount('SIGTERM') > 0) process.emit('SIGTERM');
  setTimeout(() => process.exit(0), 5000).unref();
}

async function redemarrer(raison) {
  if (_enCours) return;
  _enCours = true;
  console.log('🔄 Redémarrage du bot (' + raison + ')');

  const key = process.env.RENDER_API_KEY;
  const svc = process.env.RENDER_SERVICE_ID;
  if (key && svc) {
    try {
      const r = await fetch('https://api.render.com/v1/services/' + svc + '/restart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      });
      if (r.ok) {
        await prevenir('**Redémarrage quotidien** · demandé à Render (' + raison + ')');
        // Render va couper le process. Filet de sécurité s'il ne le fait pas.
        setTimeout(() => arretPropre(), 3 * 60 * 1000).unref();
        return;
      }
      console.error('⚠️ Redémarrage Render refusé (' + r.status + ') : arrêt du process à la place');
    } catch (err) {
      console.error('⚠️ Redémarrage Render impossible :', err.message);
    }
  }

  await prevenir('**Redémarrage quotidien** · arrêt du bot, Render le relance (' + raison + ')');
  await arretPropre();
}

function startDailyRestart(client, cron) {
  _client = client;
  const demarre = Date.now();
  // Vérifie en début de chaque heure. Garde-fou : jamais dans l'heure qui suit
  // un démarrage, pour ne pas enchaîner deux redémarrages.
  cron.schedule('0 * * * *', () => {
    const h = heureReglee();
    if (h === null || heureParis() !== h) return;
    if (Date.now() - demarre < 60 * 60 * 1000) return;
    redemarrer('tous les jours à ' + String(h).padStart(2, '0') + 'h00').catch(err => console.error('⚠️ Redémarrage :', err.message));
  }, { timezone: 'Europe/Paris' });

  const h = heureReglee();
  console.log('🔄 Redémarrage quotidien : ' + (h === null ? 'désactivé' : 'tous les jours à ' + String(h).padStart(2, '0') + 'h00')
    + (process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID ? ' (via l\'API Render)' : ' (arrêt du process)'));
}

module.exports = { startDailyRestart, redemarrer };
