const http = require('http');
require('dotenv').config();

const FS25_IP       = '195.179.229.190';
const FS25_PORT     = 9220;
const FS25_CODE     = '5dWzqhCHJmcLqADn';
const NOTIF_CHANNEL = '1541422309619802153';
const POLL_INTERVAL = 30000;

let previousPlayers = new Map(); // name -> { uptime, x, y, z }
let isFirstPoll     = true;

function fetchStats() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: FS25_IP, port: FS25_PORT,
      path: `/feed/dedicated-server-stats.xml?code=${FS25_CODE}`,
      method: 'GET', timeout: 8000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function parseStats(xml) {
  // Joueurs
  const players = new Map();
  const re = /<Player([^>]*)>([^<]*)<\/Player>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs  = m[1];
    const name   = m[2].trim();
    const usedM  = attrs.match(/isUsed="([^"]*)"/);
    if (usedM?.[1] !== 'true' || !name) continue;
    const uptime  = parseInt(attrs.match(/uptime="([^"]*)"/)?.[1] || '0');
    const x       = parseFloat(attrs.match(/x="([^"]*)"/)?.[1] || '0').toFixed(0);
    const y       = parseFloat(attrs.match(/y="([^"]*)"/)?.[1] || '0').toFixed(0);
    const z       = parseFloat(attrs.match(/z="([^"]*)"/)?.[1] || '0').toFixed(0);
    const isAdmin = attrs.match(/isAdmin="([^"]*)"/)?.[1] === 'true';
    players.set(name, { uptime, x, y, z, isAdmin });
  }

  // Serveur
  const serverM  = xml.match(/<Server([^>]*)/);
  const attrs    = serverM?.[1] || '';
  const mapName  = attrs.match(/mapName="([^"]*)"/)?.[1] || '?';
  // Le nom du serveur est dans l'attribut "name", pas "mapOverviewFilename"
  let srvName = attrs.match(/(?<![a-zA-Z])name="([^"]*)"/)?.[1] || 'EURO-AGRI';
  // Nettoyer si c'est un chemin de fichier
  if (srvName.includes('/') || srvName.includes('$moddir$')) srvName = 'EURO-AGRI';
  const dayTime  = parseInt(attrs.match(/dayTime="([^"]*)"/)?.[1] || '0');
  const version  = attrs.match(/version="([^"]*)"/)?.[1] || '?';
  const numPlayers = attrs.match(/numPlayers="([^"]*)"/)?.[1] || '0';
  const maxPlayers = attrs.match(/maxPlayers="([^"]*)"/)?.[1] || attrs.match(/capacity="([^"]*)"/)?.[1] || '?';

  const h  = Math.floor(dayTime / 3600000);
  const mn = Math.floor(dayTime / 60000) % 60;

  return {
    players, mapName, srvName, version,
    numPlayers, maxPlayers,
    time: `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`,
  };
}

function formatUptime(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1)  return 'moins d\'1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}

async function sendNotification(client, embed) {
  const channel = client.channels.cache.get(NOTIF_CHANNEL);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(console.error);
}

// Log serveur en une seule ligne (connexion / déconnexion), sans ping
async function sendLine(client, text) {
  const channel = client.channels.cache.get(NOTIF_CHANNEL);
  if (!channel) return;
  await channel.send({ content: text, allowedMentions: { parse: [] } }).catch(console.error);
}

async function poll(client) {
  try {
    const res = await fetchStats();
    if (res.status !== 200 || !res.data.includes('<')) return;

    const stats          = parseStats(res.data);
    const currentPlayers = stats.players;

    const joueurs = stats.maxPlayers && stats.maxPlayers !== '?'
      ? stats.numPlayers + '/' + stats.maxPlayers
      : stats.numPlayers;

    if (isFirstPoll) {
      isFirstPoll = false;
      previousPlayers = currentPlayers;
      console.log('🎮 FS25 Monitor démarré — ' + currentPlayers.size + ' joueur(s)');

      const playerList = currentPlayers.size === 0
        ? 'Aucun joueur connecté'
        : [...currentPlayers.entries()]
            .map(([name, d]) => '🟢 ' + name + (d.isAdmin ? ' 👑' : '') + ' — ' + formatUptime(d.uptime))
            .join('\n');

      await sendNotification(client, {
        description: [
          '🚜 **Serveur** En ligne  /  🗺️ **Carte** ' + stats.mapName + '  /  🕐 **Heure** ' + stats.time,
          '👥 **Joueurs** ' + joueurs + '  /  🎮 **Version** ' + stats.version,
          '',
          '👤 **Actuellement en ligne**',
          playerList,
        ].join('\n'),
        color: 0x2ECC71,
        footer: { text: 'FS25 Monitor — Damoclès Bot' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Connexions
    for (const [name, data] of currentPlayers) {
      if (!previousPlayers.has(name)) {
        console.log('🟢 FS25 — Connexion : ' + name);
        await sendLine(client, '🟢 **' + name + '**' + (data.isAdmin ? ' 👑' : '') + ' s\'est connecté au serveur');
      }
    }

    // Déconnexions
    for (const [name, data] of previousPlayers) {
      if (!currentPlayers.has(name)) {
        console.log('🔴 FS25 — Déconnexion : ' + name);
        await sendLine(client, '🔴 **' + name + '**' + (data.isAdmin ? ' 👑' : '') + ' s\'est déconnecté  ·  session ' + formatUptime(data.uptime));
      }
    }

    previousPlayers = currentPlayers;

  } catch (err) {
    console.error('⚠️ FS25 Monitor :', err.message);
  }
}

function startFS25Monitor(client) {
  console.log('🎮 Démarrage FS25 Monitor...');
  poll(client);
  setInterval(() => poll(client), POLL_INTERVAL);
}

module.exports = { startFS25Monitor };
