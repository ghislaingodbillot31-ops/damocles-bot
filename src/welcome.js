require('dotenv').config();

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

async function sendWelcome(member) {
  if (!WELCOME_CHANNEL_ID) return;
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  await channel.send({
    embeds: [{
      description: [
        '👋 Bienvenue <@' + member.id + '> sur **' + member.guild.name + '** !',
        '',
        '> Tu es actuellement en cours de vérification.',
        '> Rends-toi dans le salon <#' + process.env.VERIFICATION_CHANNEL_ID + '> pour suivre ta vérification.',
      ].join('\n'),
      color: 0x5865F2,
      thumbnail: { url: member.user.displayAvatarURL() },
      footer: { text: member.guild.name },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

async function sendLeave(member) {
  if (!WELCOME_CHANNEL_ID) return;
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  await channel.send({
    embeds: [{
      description: '👋 **' + member.user.username + '** a quitté le serveur.',
      color: 0x95A5A6,
      footer: { text: member.guild.name },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

module.exports = { sendWelcome, sendLeave };
