const https = require('https');

const URL = 'https://damocles-bot-zo08.onrender.com';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

function ping() {
  https.get(URL, res => {
    console.log('🟢 Keep-alive ping — status : ' + res.statusCode);
  }).on('error', err => {
    console.log('🔴 Keep-alive ping échoué : ' + err.message);
  });
}

function startKeepAlive() {
  console.log('⏱ Keep-alive démarré — ping toutes les 10 minutes');
  ping(); // ping immédiat au démarrage
  setInterval(ping, INTERVAL);
}

module.exports = { startKeepAlive };
