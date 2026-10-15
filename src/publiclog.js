const { AuditLogEvent } = require('discord.js');

// Journal PUBLIC (salon PUBLIC_LOG_CHANNEL_ID) : arrivées, joueurs validés, tickets, choix de rôle, bannissements et expulsions
// (avec la raison et l'auteur). Les départs de joueurs ne sont JAMAIS affichés, ni les avertissements ni les alertes du staff.
const SALON = () => process.env.PUBLIC_LOG_CHANNEL_ID;
const u = id => '<@' + id + '>';
const motif = r => (r || 'Aucune raison précisée').replace(/\s*\(par [^)]*\)\s*$/i, '').slice(0, 300);

// type → [couleur, titre, ligne]
const MODELES = {
  member_join:        [0x3498DB, '👋 Nouvel arrivant', d => u(d.userId) + ' vient de rejoindre le serveur.'],
  verification_ok:    [0x2ECC71, '✅ Joueur arrivé', d => u(d.userId) + ' a validé son compte et rejoint la communauté.'],
  member_activated:   [0x2ECC71, '✅ Joueur arrivé', d => u(d.userId) + ' a rejoint la communauté.'],
  reglement_accepted: [0x3498DB, '📜 Règlement accepté', d => u(d.userId) + ' a accepté le règlement.'],
  ticket_created:     [0x5865F2, '🎫 Ticket créé', d => u(d.userId) + ' a ouvert un ticket.'],
  ticket_taken:       [0x2ECC71, '✋ Ticket pris en charge', d => 'Le ticket de ' + u(d.userId) + ' est pris en charge par ' + u(d.modId) + '.'],
  ticket_closed:      [0x95A5A6, '🔒 Ticket clôturé', d => 'Le ticket de ' + u(d.userId) + ' a été clôturé par ' + u(d.modId) + '.'],
  role_added:         [0x9B59B6, '🎭 Rôle choisi', d => u(d.userId) + ' a pris le rôle **' + d.roleName + '**.'],
  role_removed:       [0x95A5A6, '🎭 Rôle retiré', d => u(d.userId) + ' a quitté le rôle **' + d.roleName + '**.'],
  member_banned:      [0xE74C3C, '🔨 Bannissement', d => u(d.userId) + ' a été **banni**.\n> **Raison :** ' + motif(d.reason) + '\n> **Par :** ' + u(d.modId)],
  member_kicked:      [0xE67E22, '👢 Expulsion', d => u(d.userId) + ' a été **expulsé**.\n> **Raison :** ' + motif(d.reason) + '\n> **Par :** ' + u(d.modId)],
};

async function publier(client, type, data = {}) {
  const modele = MODELES[type];
  const id = SALON();
  if (!modele || !id) return;
  const channel = client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
  if (!channel) return;
  const user = data.userId && (client.users.cache.get(data.userId) || await client.users.fetch(data.userId).catch(() => null));
  await channel.send({
    embeds: [{
      title: modele[1], description: modele[2](data), color: modele[0],
      ...(user ? { thumbnail: { url: user.displayAvatarURL() } } : {}),
      footer: { text: data.demo ? 'Journal public · EXEMPLE' : 'Journal public' }, timestamp: new Date().toISOString(),
    }],
    allowedMentions: { parse: [] },
  }).catch(err => console.error('⚠️ journal public :', err.message));
}

// Entrée récente du journal d'audit Discord (ban / kick) visant ce joueur : { executor, reason } ou null
async function auditRecent(guild, type, targetId) {
  const evt = type === 'ban' ? AuditLogEvent.MemberBanAdd : AuditLogEvent.MemberKick;
  for (let essai = 0; essai < 2; essai++) {
    if (essai) await new Promise(r => setTimeout(r, 1500)); // l'entrée d'audit peut arriver avec un léger retard
    const logs = await guild.fetchAuditLogs({ type: evt, limit: 6 }).catch(() => null);
    const e = logs?.entries.find(x => x.target?.id === targetId && Date.now() - x.createdTimestamp < 20_000);
    if (e) return { executor: e.executor, reason: e.reason };
  }
  return null;
}

module.exports = { publier, auditRecent };
