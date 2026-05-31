require('dotenv').config();

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Seuil à partir duquel on alerte (sur 100)
const SUSPICION_THRESHOLD = 40;

// Âge minimum d'un compte pour ne pas être suspect (en jours)
const MIN_ACCOUNT_AGE_DAYS = 30;

/**
 * Analyse un nouveau membre et calcule son score de suspicion.
 * Envoie une alerte dans les logs si le score dépasse le seuil.
 */
async function checkNewMember(member) {
  const guild = member.guild;
  const user = member.user;

  const signals = [];
  let score = 0;

  // ── 1. Âge du compte ──────────────────────────────────────────────────────
  const accountAgeDays = (Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 1) {
    signals.push({ label: '🔴 Compte créé il y a moins de 24h', points: 40 });
    score += 40;
  } else if (accountAgeDays < 7) {
    signals.push({ label: '🟠 Compte créé il y a moins de 7 jours', points: 30 });
    score += 30;
  } else if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
    signals.push({ label: `🟡 Compte créé il y a ${Math.floor(accountAgeDays)} jours`, points: 15 });
    score += 15;
  }

  // ── 2. Avatar par défaut ──────────────────────────────────────────────────
  if (!user.avatar) {
    signals.push({ label: '🟡 Aucun avatar personnalisé', points: 10 });
    score += 10;
  }

  // ── 3. Pseudo similaire à un membre existant ──────────────────────────────
  const similarMember = await findSimilarUsername(guild, user);
  if (similarMember) {
    signals.push({ label: `🟠 Pseudo similaire à <@${similarMember.id}> (${similarMember.user.tag})`, points: 30 });
    score += 30;
  }

  // ── 4. A rejoint peu après un ban récent ──────────────────────────────────
  try {
    const bans = await guild.bans.fetch({ limit: 10 });
    const recentBan = bans.find(ban => {
      const similarity = usernameSimilarity(ban.user.username, user.username);
      return similarity > 0.6;
    });
    if (recentBan) {
      signals.push({ label: `🔴 Pseudo proche d'un banni : ${recentBan.user.tag}`, points: 40 });
      score += 40;
    }
  } catch {
    // Pas la permission de voir les bans, on ignore
  }

  // ── 5. Pas de serveurs en commun (discriminant faible mais utile) ─────────
  // Note : non accessible via API bot standard, on skip

  // ── Alerte si score suffisant ─────────────────────────────────────────────
  if (score >= SUSPICION_THRESHOLD) {
    console.log(`⚠️ Double compte suspect : ${user.tag} (score: ${score}/100)`);
    await sendSuspicionAlert(guild, member, score, signals, accountAgeDays);
  } else {
    console.log(`✅ Nouveau membre OK : ${user.tag} (score: ${score}/100)`);
  }
}

/**
 * Cherche un membre existant avec un pseudo très similaire.
 */
async function findSimilarUsername(guild, newUser) {
  const members = await guild.members.fetch();
  for (const [, member] of members) {
    if (member.user.id === newUser.id) continue;
    if (member.user.bot) continue;
    const similarity = usernameSimilarity(member.user.username, newUser.username);
    if (similarity > 0.75) return member;
  }
  return null;
}

/**
 * Calcule la similarité entre deux pseudos (0 = différent, 1 = identique).
 * Basé sur la distance de Levenshtein normalisée.
 */
function usernameSimilarity(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  b = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

/**
 * Envoie une alerte dans le salon logs.
 */
async function sendSuspicionAlert(guild, member, score, signals, accountAgeDays) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const color = score >= 70 ? 0xE74C3C : score >= 50 ? 0xE67E22 : 0xF1C40F;
  const level = score >= 70 ? '🔴 Haute' : score >= 50 ? '🟠 Moyenne' : '🟡 Faible';

  const signalText = signals.map(s => `${s.label} **(+${s.points})**`).join('\n');
  const createdAt = new Date(member.user.createdTimestamp).toLocaleDateString('fr-FR');

  await logChannel.send({
    embeds: [{
      title: '⚠️ Compte suspect détecté',
      color,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: 'Membre', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'Score de suspicion', value: `**${score}/100**`, inline: true },
        { name: 'Niveau de risque', value: level, inline: true },
        { name: 'Compte créé le', value: `${createdAt} (il y a ${Math.floor(accountAgeDays)} jours)`, inline: true },
        { name: 'A rejoint le', value: new Date().toLocaleDateString('fr-FR'), inline: true },
        { name: 'Signaux détectés', value: signalText || '_Aucun_' },
        { name: 'Actions rapides', value: `\`/kick ${member.user.tag}\` • \`/ban ${member.user.tag}\`` },
      ],
      footer: { text: 'Atlas Security Bot — Vérifiez manuellement avant toute action' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

module.exports = { checkNewMember };
