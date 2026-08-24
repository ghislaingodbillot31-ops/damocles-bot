const https = require('https');
const http  = require('http');
require('dotenv').config();

const FS25_IP       = '195.179.229.190';
const FS25_PORT     = 9220;
const FS25_CODE     = '5dWzqhCHJmcLqADn';
const NOTIF_CHANNEL = '1541422309619802153';
const POLL_INTERVAL = 30000; // 30 secondes

let previousPlayers = new Set();
let isFirstPoll     = true;

// ── Requête HTTP vers FS25 ────────────────────────────────────────────────────
function fetchStats() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: FS25_IP,
      port:     FS25_PORT,
      path:     `/feed/dedicated-server-stats.xml?code=${FS25_CODE}`,
      method:   'GET',
      timeout:  8000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ── Parser XML ────────────────────────────────────────────────────────────────
function parseStats(xml) {
  const players = [];
  const re = /<Player([^>]*)>([^<]*)<\/Player>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const usedM = m[1].match(/isUsed="([^"]*)"/);
    const name  = m[2].trim();
    if (usedM?.[1] === 'true' && name) players.push(name);
  }

  const mapM  = xml.match(/mapName="([^"]*)"/);
  const dayM  = xml.match(/dayTime="([^"]*)"/);
  const h     = Math.floor(parseInt(dayM?.[1] || 0) / 3600000);
  const mn    = Math.floor(parseInt(dayM?.[1] || 0) / 60000) % 60;

  return {
    players,
    mapName: mapM?.[1] || '?',
    time:    `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`,
  };
}

// ── Envoyer embed Discord ─────────────────────────────────────────────────────
async function sendNotification(client, embed) {
  const channel = client.channels.cache.get(NOTIF_CHANNEL);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(console.error);
}

// ── Poll principal ────────────────────────────────────────────────────────────
async function poll(client) {
  try {
    const res = await fetchStats();
    if (res.status !== 200 || !res.data.includes('<')) return;

    const stats          = parseStats(res.data);
    const currentPlayers = new Set(stats.players);

    if (isFirstPoll) {
      isFirstPoll = false;
      previousPlayers = currentPlayers;
      console.log('🎮 FS25 Monitor démarré — ' + currentPlayers.size + ' joueur(s) connecté(s)');

      // Message de statut initial
      await sendNotification(client, {
        title: '🚜 Serveur Euro Agri — En ligne',
        description: [
          '**Carte :** ' + stats.mapName,
          '**Heure in-game :** ' + stats.time,
          '**Joueurs :** ' + (currentPlayers.size === 0 ? 'Aucun' : [...currentPlayers].map(p => '`' + p + '`').join(', ')),
        ].join('\n'),
        color: 0x2ECC71,
        footer: { text: 'FS25 Monitor — Damoclès Bot' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Détection connexions
    for (const player of currentPlayers) {
      if (!previousPlayers.has(player)) {
        console.log('🟢 FS25 — Connexion : ' + player);
        await sendNotification(client, {
          description: '🟢 **' + player + '** a rejoint le serveur **Euro Agri**',
          color: 0x2ECC71,
          footer: { text: 'FS25 Monitor • ' + currentPlayers.size + ' joueur(s) en ligne' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Détection déconnexions
    for (const player of previousPlayers) {
      if (!currentPlayers.has(player)) {
        console.log('🔴 FS25 — Déconnexion : ' + player);
        await sendNotification(client, {
          description: '🔴 **' + player + '** a quitté le serveur **Euro Agri**',
          color: 0xE74C3C,
          footer: { text: 'FS25 Monitor • ' + currentPlayers.size + ' joueur(s) en ligne' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    previousPlayers = currentPlayers;

  } catch (err) {
    console.error('⚠️ FS25 Monitor — Erreur poll :', err.message);
  }
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
function startFS25Monitor(client) {
  console.log('🎮 Démarrage FS25 Monitor...');
  poll(client);
  setInterval(() => poll(client), POLL_INTERVAL);
}

module.exports = { startFS25Monitor };
