const config = require('./config');

/**
 * Remplace les variables dans un message
 */
function formatMessage(template, data) {
  return template
    .replace(/{user}/g,        data.mention || '')
    .replace(/{username}/g,    data.username || '')
    .replace(/{server}/g,      data.guildName || '')
    .replace(/{membercount}/g, data.memberCount || '')
    .replace(/{inviter}/g,     data.inviter || 'Inconnu')
    .replace(/{invite}/g,      data.inviteCode || 'Inconnu');
}

/**
 * Envoie le message de bienvenue
 */
async function sendWelcome(member) {
  const cfg = config.get();
  if (!cfg.WELCOME_ENABLED || !cfg.WELCOME_CHANNEL_ID) return;

  const channel = member.guild.channels.cache.get(cfg.WELCOME_CHANNEL_ID);
  if (!channel) return;

  // Récupérer l'inviteur
  let inviter = 'Inconnu', inviteCode = 'Inconnu';
  try {
    const invites = await member.guild.invites.fetch();
    // On compare avec les invitations connues pour trouver laquelle a été utilisée
    const usedInvite = invites.find(inv => inv.uses > 0);
    if (usedInvite) {
      inviter = usedInvite.inviter?.tag || 'Inconnu';
      inviteCode = usedInvite.code;
    }
  } catch {}

  const text = formatMessage(cfg.WELCOME_MESSAGE || 'Bienvenue {user} !', {
    mention:     '<@' + member.id + '>',
    username:    member.user.username,
    guildName:   member.guild.name,
    memberCount: member.guild.memberCount,
    inviter,
    inviteCode,
  });

  const color = parseInt(cfg.WELCOME_COLOR || '5865F2', 16);

  await channel.send({
    embeds: [{
      description: text,
      color,
      thumbnail: { url: member.user.displayAvatarURL() },
      footer: { text: member.guild.name },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

/**
 * Envoie le message de départ
 */
async function sendLeave(member) {
  const cfg = config.get();
  if (!cfg.LEAVE_ENABLED) return;

  const channelId = cfg.LEAVE_CHANNEL_ID || cfg.WELCOME_CHANNEL_ID;
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const text = formatMessage(cfg.LEAVE_MESSAGE || '{username} a quitté le serveur.', {
    mention:     '<@' + member.id + '>',
    username:    member.user.username,
    guildName:   member.guild.name,
    memberCount: member.guild.memberCount,
  });

  await channel.send({
    embeds: [{
      description: text,
      color: 0x95A5A6,
      footer: { text: member.guild.name },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

module.exports = { sendWelcome, sendLeave };
