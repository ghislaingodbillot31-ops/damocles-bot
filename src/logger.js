require('dotenv').config();

const DAMOCLES_LOG_CHANNEL_ID = process.env.DAMOCLES_LOG_CHANNEL_ID;

async function log(client, type, data) {
  if (!DAMOCLES_LOG_CHANNEL_ID) return;
  const channel = client.channels.cache.get(DAMOCLES_LOG_CHANNEL_ID);
  if (!channel) return;

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  let description, color;

  switch (type) {
    case 'member_join':
      description = '`▶` 👋 Nouveau membre ............. <@' + data.userId + '>\n`▶` 🕐 Arrivée ........................ ' + now;
      color = 0x3498DB;
      break;

    case 'verification_ok':
      description = '`▶` ✅ Vérification ............... Accordée\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🕐 Date .......................... ' + now;
      color = 0x2ECC71;
      break;

    case 'verification_failed':
      description = '`▶` ⛔ Vérification ............... Refusée\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` ❌ Raisons ....................... ' + data.reasons + '\n`▶` 🕐 Date .......................... ' + now;
      color = 0xE74C3C;
      break;

    case 'reglement_accepted':
      description = '`▶` 📜 Règlement ................... Accepté\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🕐 Date .......................... ' + now;
      color = 0x3498DB;
      break;

    case 'member_activated':
      description = '`▶` ✅ Statut ....................... Actif\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 📌 Via ........................... ' + data.source + '\n`▶` 🕐 Date .......................... ' + now;
      color = 0x2ECC71;
      break;

    case 'role_added':
      description = '`▶` 🎭 Rôle ......................... Attribué\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🏷️ Rôle .......................... **' + data.roleName + '**\n`▶` 🕐 Date .......................... ' + now;
      color = 0x9B59B6;
      break;

    case 'role_removed':
      description = '`▶` 🎭 Rôle ......................... Retiré\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🏷️ Rôle .......................... **' + data.roleName + '**\n`▶` 🕐 Date .......................... ' + now;
      color = 0x95A5A6;
      break;

    case 'member_kicked':
      description = '`▶` 👢 Expulsion ................... Effectuée\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🛡️ Modérateur ................... <@' + data.modId + '>\n`▶` 📋 Raison ........................ ' + data.reason + '\n`▶` 🕐 Date .......................... ' + now;
      color = 0xE67E22;
      break;

    case 'member_banned':
      description = '`▶` 🔨 Bannissement ................ Effectué\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🛡️ Modérateur ................... <@' + data.modId + '>\n`▶` 📋 Raison ........................ ' + data.reason + '\n`▶` 🕐 Date .......................... ' + now;
      color = 0xE74C3C;
      break;

    case 'warning_added':
      description = '`▶` ⚠️ Avertissement ............... ' + data.count + '/3\n`▶` 👤 Membre ........................ <@' + data.userId + '>\n`▶` 🛡️ Modérateur ................... <@' + data.modId + '>\n`▶` 📋 Raison ........................ ' + data.reason + '\n`▶` 🕐 Date .......................... ' + now;
      color = 0xF39C12;
      break;

    case 'analyse_done':
      description = '`▶` 📊 Analyse quotidienne ......... Terminée\n`▶` 🟡 Nouveaux inactifs ............. **' + data.inactive + '**\n`▶` ✅ Réactivés ..................... **' + data.reactivated + '**\n`▶` ⚠️ À expulser .................... **' + data.toExpel + '**\n`▶` 🕐 Date .......................... ' + now;
      color = 0x5865F2;
      break;

    default:
      return;
  }

  await channel.send({
    embeds: [{
      description,
      color,
      footer: { text: 'Damoclès Log' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(err => console.error('Erreur log :', err.message));
}

module.exports = { log };
