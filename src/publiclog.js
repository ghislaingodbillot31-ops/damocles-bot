const { AuditLogEvent } = require('discord.js');

// Journal PUBLIC (salon PUBLIC_LOG_CHANNEL_ID) : arrivées, joueurs validés, tickets, choix de rôle, bannissements et expulsions
// (avec la raison et l'auteur). Les départs de joueurs ne sont JAMAIS affichés, ni les avertissements ni les alertes du staff.
// Design Discord natif : un petit embed par événement (+ raison et auteur pour un ban / une expulsion).
const SALON = () => process.env.PUBLIC_LOG_CHANNEL_ID;
const motif = r => (r || 'aucune raison précisée').replace(/\s*\(par [^)]*\)\s*$/i, '').replace(/\s+/g, ' ');

// type → [couleur de la barre, icône, verbe] ; 4e valeur true = ban / expulsion (raison + auteur)
const MODELES = {
  member_join:        [0x3498DB, '📥', () => 'rejoint le serveur'],
  verification_ok:    [0x2ECC71, '✅', () => 'a validé son compte'],
  member_activated:   [0x2ECC71, '✅', () => 'a rejoint la communauté'],
  reglement_accepted: [0x3498DB, '📜', () => 'a accepté le règlement'],
  ticket_created:     [0x5865F2, '🎫', () => 'ouvre un ticket'],
  ticket_taken:       [0x2ECC71, '🎫', (d, m) => 'ticket pris par ' + m],
  ticket_closed:      [0x95A5A6, '🎫', (d, m) => 'ticket clôturé par ' + m],
  role_added:         [0x9B59B6, '➕', d => 'a pris le rôle **' + d.roleName + '**'],
  role_removed:       [0x95A5A6, '➖', d => 'a retiré le rôle **' + d.roleName + '**'],
  member_banned:      [0xE74C3C, '🔨', () => 'a été banni', true],
  member_kicked:      [0xE67E22, '👢', () => 'a été expulsé', true],
};

async function nom(client, id) {
  if (!id) return '?';
  const u = client.users.cache.get(id) || await client.users.fetch(id).catch(() => null);
  return u ? (u.globalName || u.username) : String(id).slice(-6);
}

async function publier(client, type, data = {}) {
  const modele = MODELES[type];
  const id = SALON();
  if (!modele || !id) return;
  const channel = client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
  if (!channel) return;

  const joueur = (await nom(client, data.userId)).slice(0, 32), mod = (await nom(client, data.modId)).slice(0, 32);
  const [couleur, icone, verbe, detail] = modele;
  const embed = { description: icone + ' **' + joueur + '** ' + verbe(data, mod), color: couleur, timestamp: new Date().toISOString() };
  if (detail) embed.fields = [{ name: 'Raison', value: motif(data.reason).slice(0, 1024), inline: true }, { name: 'Par', value: mod, inline: true }];
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

// Panneau de vérification : embed Discord natif (champs). checks = résultats de verification.runChecks (peut être partiel
// pendant l'animation) ; verdict : null (en cours) | 'ok' | 'ko' | 'auto'. Retourne { title, color, fields, footer } prêt pour un embed.
function panneauVerif(user, checks, serveur = 'SERVEUR', verdict = 'auto') {
  const age = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
  const echecs = checks.filter(c => !c.passed);
  if (verdict === 'auto') verdict = echecs.length ? 'ko' : 'ok';
  const alerte = checks.some(c => c.value && c.type !== 'oui_non') || echecs.length > 0 || checks.some(c => c.label.includes('Sanctions') && c.value);

  const lignes = checks.map(c => {
    const nom = c.label.replace(/^\S+\s+/, '');
    if (c.label.includes('Âge')) return (c.passed ? '✅' : '❌') + ' **' + nom + '** · ' + age + ' j (min. 7)';
    if (c.type === 'classic') return (c.passed ? '✅' : '❌') + ' **' + nom + '** · ' + (c.passed ? 'conforme' : 'ÉCHEC');
    return (c.value ? (c.type === 'danger' ? '❌' : '⚠️') : '✅') + ' **' + nom + '** · ' + (c.value ? 'OUI' : 'non');
  });
  const fields = [{
    name: 'Joueur',
    value: (user.globalName ? user.globalName + ' (' + user.username + ')' : user.username) + '\nID : `' + user.id + '`\nCompte créé le ' + new Date(user.createdTimestamp).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }),
  }];
  if (lignes.length) fields.push({ name: 'Contrôles', value: lignes.join('\n').slice(0, 1024) });
  fields.push({ name: 'Verdict', value: verdict === 'ok' ? '✅ Compte validé · accès accordé' : verdict === 'ko' ? '❌ Refusé · décision du staff' + echecs.filter(c => c.detail).map(c => '\n' + c.detail.slice(0, 200)).join('') : '⏳ Analyse en cours' });
  return {
    title: '🔍 Vérification joueur · ' + serveur,
    fields,
    color: verdict === 'ko' ? 0xE74C3C : verdict === null ? 0xF1C40F : alerte ? 0xE67E22 : 0x2ECC71,
    footer: { text: user.id },
    timestamp: new Date().toISOString(),
  };
}

// À chaque démarrage : une ligne « En attente de logs » à la suite de l'historique (rien n'est jamais supprimé)
async function demarrer(client) {
  const id = SALON();
  const channel = id && (client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null));
  if (!channel) return;
  await channel.send({ embeds: [{ description: '⏳ En attente de logs', color: 0xF1C40F, timestamp: new Date().toISOString() }], allowedMentions: { parse: [] } })
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
