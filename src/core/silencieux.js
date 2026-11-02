// Aucune notification publique : tout message que le bot poste dans un salon du serveur part en « silencieux »
// (ni push, ni badge de mention). Seuls les salons de ticket gardent leurs notifications (le staff y est prévenu).
// Les réponses aux interactions et les MP ne passent pas par ici.
const SILENCE = 4096; // MessageFlags.SuppressNotifications

const sansNotif = payload => {
  const p = typeof payload === 'string' ? { content: payload } : { ...payload };
  p.flags = (Number(p.flags) || 0) | SILENCE;
  return p;
};

function installer() {
  const { TextChannel } = require('discord.js');
  const envoyer = TextChannel.prototype.send;
  TextChannel.prototype.send = function (payload) {
    return envoyer.call(this, /ticket/i.test(this.name) ? payload : sansNotif(payload));
  };
}

module.exports = { installer, sansNotif, SILENCE };
