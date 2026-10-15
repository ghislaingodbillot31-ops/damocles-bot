// Vérification par code (VERIF_MODE=code, serveur DOMINIUS) : le nouvel arrivant reçoit un
// code dans le salon de vérification, le retape, et obtient le rôle Membres. Aucune expulsion.
const crypto = require('crypto');
const db = require('./database');
const { log } = require('./logger');

const channelId = () => process.env.VERIFICATION_CHANNEL_ID;
const codes = new Map(); // userId → { code, msg }  (perdu au redémarrage : un nouveau code est alors redonné)

async function issue(member) {
  const channel = member.guild.channels.cache.get(channelId());
  if (!channel) return;
  const prev = codes.get(member.id);
  if (prev) prev.msg?.delete().catch(() => {});
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const msg = await channel.send({
    content: '<@' + member.id + '>',
    embeds: [{
      title: '🔐 Vérification',
      description: 'Bienvenue sur **' + member.guild.name + '** !\nTape ce code dans ce salon pour accéder au serveur :\n# `' + code + '`',
      color: 0x3498DB,
    }],
  }).catch(() => null);
  codes.set(member.id, { code, msg });
}

const flash = async (channel, text) => {
  const m = await channel.send(text).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), 6000);
};

// true = message traité (salon de vérification), l'appelant s'arrête là
async function onMessage(message) {
  if (message.channel.id !== channelId()) return false;
  const { member } = message;
  const membreId = process.env.MEMBRE_ROLE_ID;
  if (member.roles.cache.has(membreId) || member.permissions.has('ManageMessages')) return false;

  message.delete().catch(() => {});
  const entry = codes.get(member.id);
  if (!entry) { await issue(member); return true; }
  if (message.content.trim().toUpperCase() !== entry.code) {
    await flash(message.channel, '❌ <@' + member.id + '> code incorrect, réessaie.');
    return true;
  }
  await member.roles.add(membreId).catch(() => {});
  if (process.env.VERIFICATION_ROLE_ID) await member.roles.remove(process.env.VERIFICATION_ROLE_ID).catch(() => {});
  await db.upsertMember(member.user, { verifiedAt: new Date().toISOString(), verificationResult: 'ok' });
  entry.msg?.delete().catch(() => {});
  codes.delete(member.id);
  await flash(message.channel, '✅ <@' + member.id + '> vérifié, bienvenue !');
  await log(message.client, 'verification_ok', { userId: member.id });
  return true;
}

module.exports = { issue, onMessage };
