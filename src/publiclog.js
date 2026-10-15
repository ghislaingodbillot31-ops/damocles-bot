const { AuditLogEvent } = require('discord.js');

// Journal PUBLIC (salon PUBLIC_LOG_CHANNEL_ID) : arrivées, joueurs validés, tickets, choix de rôle, bannissements et expulsions
// (avec la raison et l'auteur). Les départs de joueurs ne sont JAMAIS affichés, ni les avertissements ni les alertes du staff.
// Style identique au centre de contrôle (statusbot) : console ANSI de même largeur, 1 ligne (2 pour un ban / une expulsion), sans image.
const SALON = () => process.env.PUBLIC_LOG_CHANNEL_ID;
const sb = () => require('./statusbot');
const motif = r => (r || 'aucune raison précisée').replace(/\s*\(par [^)]*\)\s*$/i, '').replace(/\s+/g, ' ');

// type → [couleur de la barre, étiquette (7 car.), couleur de l'étiquette, verbe] ; r = ligne de détail (ban / expulsion)
const MODELES = {
  member_join:        [0x3498DB, 'JOIN   ', 'cyan',  () => 'rejoint le serveur'],
  verification_ok:    [0x2ECC71, 'ARRIVÉ ', 'vert',  () => 'a validé son compte'],
  member_activated:   [0x2ECC71, 'ARRIVÉ ', 'vert',  () => 'a rejoint la communauté'],
  reglement_accepted: [0x3498DB, 'RÈGLE ✔', 'bleu',  () => 'a accepté le règlement'],
  ticket_created:     [0x5865F2, 'TICKET ', 'bleu',  () => 'ouvre un ticket'],
  ticket_taken:       [0x2ECC71, 'TICKET ', 'vert',  (d, m) => 'pris par ' + m],
  ticket_closed:      [0x95A5A6, 'TICKET ', 'gris',  (d, m) => 'clôturé par ' + m],
  role_added:         [0x9B59B6, 'RÔLE + ', 'violet', d => d.roleName],
  role_removed:       [0x95A5A6, 'RÔLE − ', 'gris',  d => d.roleName],
  member_banned:      [0xE74C3C, 'BAN    ', 'rouge', () => 'banni', true],
  member_kicked:      [0xE67E22, 'KICK   ', 'jaune', () => 'expulsé', true],
};

async function nom(client, id) {
  if (!id) return '?';
  const u = client.users.cache.get(id) || await client.users.fetch(id).catch(() => null);
  return u ? (u.globalName || u.username) : String(id).slice(-6);
}

// Une ligne de la console : segments [couleur, texte], complétée à la largeur du centre de contrôle ;
// si elle dépasse, on raccourcit le segment « souple » (le dernier par défaut)
function ligne(segs, souple = segs.length - 1) {
  const { W } = sb();
  let total = segs.reduce((n, s) => n + s[1].length, 0);
  if (total > W) {
    const seg = segs[souple];
    seg[1] = seg[1].slice(0, Math.max(0, seg[1].length - (total - W) - 1)) + '…';
    total = segs.reduce((n, s) => n + s[1].length, 0);
  }
  return segs.map(([f, t]) => f(t)).join('') + ' '.repeat(Math.max(0, W - total));
}

async function publier(client, type, data = {}) {
  const modele = MODELES[type];
  const id = SALON();
  if (!modele || !id) return;
  const channel = client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
  if (!channel) return;

  const { ansi, hhmmss } = sb();
  const joueur = (await nom(client, data.userId)).slice(0, 16), mod = (await nom(client, data.modId)).slice(0, 16);
  const [couleur, tag, teinte, verbe, detail] = modele;
  const heure = hhmmss(Date.now());
  const lignes = [ligne([[ansi.gris, heure + ' '], [ansi[teinte], tag + ' '], [ansi.blanc, joueur + ' '], [ansi.gris, verbe(data, mod)]])];
  if (detail) {
    lignes.push(ligne([[ansi.gris, ' '.repeat(heure.length + 1)], [ansi.gris, 'raison '], [ansi.blanc, motif(data.reason)], [ansi.gris, ' · par '], [ansi.cyan, mod]], 2));
  }
  await channel.send({
    embeds: [{ description: '```ansi\n' + lignes.join('\n') + '\n```', color: couleur }],
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
