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
  const embed = { description: '```ansi\n' + lignes.join('\n') + '\n```', color: couleur };
  if (type === 'verification_ok') {
    const user = client.users.cache.get(data.userId) || await client.users.fetch(data.userId).catch(() => null);
    const checks = user && await require('./verification').runChecks({ user }).catch(() => null);
    if (checks) {
      Object.assign(embed, panneauVerif(user, checks, channel.guild?.name));
      await alerteStaff(client, channel.guild, user, checks);
    }
  }
  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] },
  }).catch(err => console.error('⚠️ journal public :', err.message));
}

// Alerte dans le salon STAFF ALERTE (ping du rôle admin) quand un contrôle est orange : compte < 7 jours, pseudo anormal
// ou injurieux, déjà expulsé, départ volontaire
async function alerteStaff(client, guild, user, checks) {
  try {
    const par = label => checks.find(c => c.label.includes(label));
    const motifs = [
      ['Âge', c => !c.passed, 'Compte de moins de 7 jours'],
      ['Pseudo', c => !c.passed, 'Pseudo anormal ou injurieux'],
      ['Expulsions', c => c.value, 'Déjà expulsé du serveur'],
      ['Départ', c => c.value, 'Départ volontaire précédent'],
    ].filter(([l, test]) => par(l) && test(par(l))).map(([l, , txt]) => '• **' + txt + '**' + (par(l).detail ? ' · ' + par(l).detail : ''));
    if (!motifs.length) return;
    const id = process.env.STAFF_ALERT_CHANNEL_ID || '1559691536021856346';
    const salon = client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
    if (!salon) return;
    const admin = guild?.roles.cache.find(r => /admin/i.test(r.name) && !r.managed);
    await salon.send({
      content: admin ? '<@&' + admin.id + '>' : undefined,
      embeds: [{
        title: '🚨  ALERTE VÉRIFICATION',
        description: '<@' + user.id + '> (`' + user.username + '`) a validé son code, vérification requise :\n\n' + motifs.join('\n'),
        color: 0xE67E22,
        footer: { text: user.id },
      }],
      allowedMentions: { roles: admin ? [admin.id] : [], users: [] },
    });
  } catch (err) { console.error('⚠️ alerte staff :', err.message); }
}

// Panneau de vérification, même style que le centre de contrôle (statusbot) : cadre, sections, lignes « ▸ libellé ··· valeur ».
// checks = résultats de verification.runChecks (peut être partiel pendant l'animation) ; verdict : null (en cours) | 'ok' | 'ko'
// Retourne { title, description, color, footer } prêt pour un embed.
function panneauVerif(user, checks, serveur = 'SERVEUR', verdict = 'auto') {
  const { ansi: a, W } = sb();
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
  const row = (l, v, col) => ' ' + a.gris('▸ ') + a.blanc(l) + ' ' + a.gris('·'.repeat(Math.max(2, 24 - l.length))) + ' ' + col(v);
  const age = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
  const echecs = checks.filter(c => !c.passed);
  if (verdict === 'auto') verdict = echecs.length ? 'ko' : 'ok';
  const alerte = checks.some(c => c.value && c.type !== 'oui_non') || echecs.length > 0 || checks.some(c => c.label.includes('Sanctions') && c.value);

  const out = [
    a.cyan('╔' + '═'.repeat(W - 2) + '╗'),
    a.cyan('║') + a.blanc(pad('  ◢◤ ' + String(serveur).toUpperCase() + ' · VÉRIFICATION', W - 2 - 8)) + (verdict === 'ok' ? a.vert('  ✔ OK ') : verdict === 'ko' ? a.rouge(' ✖ ÉCHEC ') : a.jaune(' ⏳ ... ')) + a.cyan('║'),
    a.cyan('╚' + '═'.repeat(W - 2) + '╝'),
    a.gris(' ┌─ ') + a.jaune('JOUEUR') + a.gris(' ' + '─'.repeat(W - 12)),
    row('Pseudo', user.globalName ? user.globalName + ' (' + user.username + ')' : user.username, a.blanc),
    row('Identifiant', user.id, a.cyan),
    row('Compte créé le', new Date(user.createdTimestamp).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }), a.cyan),
    a.gris(' ├─ ') + a.jaune('CONTRÔLES') + a.gris(' ' + '─'.repeat(W - 15)),
  ];
  for (const c of checks) {
    const nom = c.label.replace(/^\S+\s+/, '');
    if (c.label.includes('Âge')) out.push(row(nom, age + ' j (min. 7)', c.passed ? a.vert : a.rouge));
    else if (c.type === 'classic') out.push(row(nom, c.passed ? 'conforme' : 'ÉCHEC', c.passed ? a.vert : a.rouge));
    else out.push(row(nom, c.value ? 'OUI' : 'non', c.value ? (c.type === 'danger' ? a.rouge : a.jaune) : a.vert));
  }
  out.push(a.gris(' └─ ') + a.jaune('VERDICT') + a.gris(' ' + '─'.repeat(W - 13)));
  out.push(' ' + (verdict === 'ok' ? a.vert('✔ Compte validé · accès accordé') : verdict === 'ko' ? a.rouge('✖ Refusé · décision du staff') : a.jaune('⏳ analyse en cours')));
  for (const c of verdict === 'ko' ? echecs : []) if (c.detail) out.push('   ' + a.gris(c.detail.slice(0, W - 5)));
  return {
    title: '🔍  VÉRIFICATION JOUEUR',
    description: '```ansi\n' + out.join('\n') + '\n```',
    color: verdict === 'ko' ? 0xE74C3C : verdict === null ? 0xF1C40F : alerte ? 0xE67E22 : 0x00E5FF,
    footer: { text: '● ' + new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
  };
}

// À chaque démarrage : une ligne « En attente de logs » à la suite de l'historique (rien n'est jamais supprimé)
async function demarrer(client) {
  const id = SALON();
  const channel = id && (client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null));
  if (!channel) return;
  const { ansi, hhmmss } = sb();
  const l = ligne([[ansi.gris, hhmmss(Date.now()) + ' '], [ansi.jaune, 'SYSTÈME '], [ansi.blanc, 'En attente de logs'], [ansi.jaune, ' ▓░░']]);
  await channel.send({ embeds: [{ description: '```ansi\n' + l + '\n```', color: 0xF1C40F }], allowedMentions: { parse: [] } })
    .catch(err => console.error('⚠️ journal public :', err.message));
  console.log('📰 Journal public · prêt (#' + channel.name + ')');
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

module.exports = { publier, demarrer, auditRecent, panneauVerif, alerteStaff };
