require('dotenv').config();

const DAMOCLES_LOG_CHANNEL_ID = process.env.DAMOCLES_LOG_CHANNEL_ID;

async function log(client, type, data) {
  if (!DAMOCLES_LOG_CHANNEL_ID) return;
  const channel = client.channels.cache.get(DAMOCLES_LOG_CHANNEL_ID);
  if (!channel) return;

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  let text, color;
  const t = (label, value) => `\`${label}\` ${value}`;

  switch (type) {
    case 'member_join':
      text  = '`▶` 👋 **Nouveau membre** — <@' + data.userId + '> — ' + now;
      color = 0x3498DB;
      break;

    case 'verification_ok':
      text  = '`▶` ✅ **Vérification accordée** — <@' + data.userId + '> — ' + now;
      color = 0x2ECC71;
      break;

    case 'verification_failed':
      text  = '`▶` ⛔ **Vérification refusée** — <@' + data.userId + '> — ' + data.reasons + ' — ' + now;
      color = 0xE74C3C;
      break;

    case 'reglement_accepted':
      text  = '`▶` 📜 **Règlement accepté** — <@' + data.userId + '> — ' + now;
      color = 0x3498DB;
      break;

    case 'first_message':
      text  = '`▶` 💬 **Premier message** — <@' + data.userId + '> dans #' + data.channelName + ' : ' + data.content + ' — ' + now;
      color = 0x2ECC71;
      break;

    case 'member_activated':
      text  = '`▶` ✅ **Membre activé** — <@' + data.userId + '> via ' + data.source + ' — ' + now;
      color = 0x2ECC71;
      break;

    case 'role_added':
      text  = '`▶` 🎭 **Rôle attribué** — <@' + data.userId + '> → **' + data.roleName + '** — ' + now;
      color = 0x9B59B6;
      break;

    case 'role_removed':
      text  = '`▶` 🎭 **Rôle retiré** — <@' + data.userId + '> ← **' + data.roleName + '** — ' + now;
      color = 0x95A5A6;
      break;

    case 'member_kicked':
      text  = '`▶` 👢 **Expulsion** — <@' + data.userId + '> par <@' + data.modId + '> — ' + data.reason + ' — ' + now;
      color = 0xE67E22;
      break;

    case 'member_banned':
      text  = '`▶` 🔨 **Bannissement** — <@' + data.userId + '> par <@' + data.modId + '> — ' + data.reason + ' — ' + now;
      color = 0xE74C3C;
      break;

    case 'warning_added':
      text  = '`▶` ⚠️ **Avertissement ' + data.count + '/3** — <@' + data.userId + '> par <@' + data.modId + '> — ' + data.reason + ' — ' + now;
      color = 0xF39C12;
      break;

    case 'analyse_done':
      text  = '`▶` 📊 **Analyse** — 🟡 ' + data.inactive + ' inactifs | ✅ ' + data.reactivated + ' réactivés | ⚠️ ' + data.toExpel + ' à expulser — ' + now;
      color = 0x5865F2;
      break;

    case 'raid_detected':
      text  = '`▶` 🚨 **Anti-raid** — ' + data.count + ' joins détectés — <@' + data.userId + '> — ' + now;
      color = 0xE74C3C;
      break;

    case 'spam_detected':
      text  = '`▶` 🚫 **Anti-spam** — <@' + data.userId + '> dans #' + data.channelName + ' — ' + now;
      color = 0xE74C3C;
      break;

    case 'link_detected':
      text  = '`▶` 🔗 **Lien suspect** — <@' + data.userId + '> dans #' + data.channelName + ' — ' + data.links + ' — ' + now;
      color = 0xF39C12;
      break;

    case 'ticket_created':
      text  = '`▶` 🎫 **Ticket créé** — <@' + data.userId + '> → #' + data.channelName + ' — ' + now;
      color = 0x5865F2;
      break;

    case 'ticket_taken':
      text  = '`▶` ✋ **Ticket pris en charge** — <@' + data.userId + '> par <@' + data.modId + '> — ' + now;
      color = 0x2ECC71;
      break;

    case 'ticket_closed':
      text  = '`▶` 🔒 **Ticket clôturé** — <@' + data.userId + '> par <@' + data.modId + '> — ' + now;
      color = 0x95A5A6;
      break;

    case 'banned_word':
      text  = '`▶` 🚫 **Mot interdit** — <@' + data.userId + '> dans #' + data.channelName + ' — ' + now;
      color = 0xE74C3C;
      break;

    default:
      return;
  }

  await channel.send({
    embeds: [{
      description: text,
      color,
      footer: { text: 'Damoclès Log' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(err => console.error('Erreur log :', err.message));
}

module.exports = { log };
