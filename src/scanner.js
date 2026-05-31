require('dotenv').config();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const EXCLUDED_ROLE_IDS = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);
const INACTIVE_ROLE_ID  = process.env.INACTIVE_ROLE_ID;
const ACTIVE_ROLE_ID    = process.env.ACTIVE_ROLE_ID;
const LOG_CHANNEL_ID    = process.env.LOG_CHANNEL_ID;

const INACTIVITY_DAYS = 15;
const KICK_DAYS       = 60;
const INACTIVITY_MS   = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
const KICK_MS         = KICK_DAYS * 24 * 60 * 60 * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.data?.retry_after && i < retries - 1) {
        const wait = (err.data.retry_after + 2) * 1000;
        console.log(`⏳ Rate limit — attente de ${Math.ceil(wait / 1000)}s...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

async function scanInactiveMembers(guild, activeMemberIds) {
  console.log(`\n🔍 Scan du serveur : ${guild.name}`);
  console.log(`📅 Inactif après ${INACTIVITY_DAYS}j | Alerte expulsion après ${KICK_DAYS}j`);

  if (!INACTIVE_ROLE_ID) { console.error('❌ INACTIVE_ROLE_ID manquant dans .env'); return; }

  const inactiveRole = guild.roles.cache.get(INACTIVE_ROLE_ID);
  if (!inactiveRole) { console.error(`❌ Rôle Inactif introuvable`); return; }

  try {
    const members = await fetchWithRetry(() => guild.members.fetch());

    const targets = new Map();
    for (const [id, member] of members) {
      if (member.user.bot) continue;
      if (EXCLUDED_ROLE_IDS.some(rid => member.roles.cache.has(rid))) continue;
      targets.set(id, member);
    }
    console.log(`👥 ${targets.size} membres humains à analyser`);

    const lastActivity = await fetchLastActivity(guild, activeMemberIds);
    console.log(`✉️  ${lastActivity.size} membres avec activité récente détectée`);

    const now = Date.now();
    const inactiveCutoff = now - INACTIVITY_MS;
    const kickCutoff     = now - KICK_MS;

    let tagged = 0;
    let untagged = 0;
    let kickAlerts = 0;
    const inactiveList = [];

    for (const [id, member] of targets) {
      const last = lastActivity.get(id);

      // ── +60 jours : alerte avec boutons dans les logs ─────────────────────
      if (!last || last < kickCutoff) {
        const daysInactive = last
          ? Math.floor((now - last) / 86400000)
          : Math.floor((now - member.joinedTimestamp) / 86400000);

        await sendKickAlert(guild, member, daysInactive);
        kickAlerts++;
        await sleep(500);
        continue;
      }

      // ── 15 à 60 jours : rôle Inactif ──────────────────────────────────────
      if (last < inactiveCutoff) {
        if (!member.roles.cache.has(INACTIVE_ROLE_ID)) {
          const rolesToRemove = member.roles.cache.filter(r =>
            r.id !== guild.id && r.id !== INACTIVE_ROLE_ID && r.editable
          );
          for (const [, role] of rolesToRemove) {
            await member.roles.remove(role).catch(console.error);
            await sleep(300);
          }
          await member.roles.add(inactiveRole).catch(console.error);
          tagged++;
        }
        const daysInactive = Math.floor((now - last) / 86400000);
        inactiveList.push(`<@${id}> — inactif depuis ${daysInactive} jours`);

      // ── Actif ──────────────────────────────────────────────────────────────
      } else {
        if (member.roles.cache.has(INACTIVE_ROLE_ID)) {
          await member.roles.remove(inactiveRole).catch(console.error);
          if (ACTIVE_ROLE_ID && !member.roles.cache.has(ACTIVE_ROLE_ID)) {
            await member.roles.add(ACTIVE_ROLE_ID).catch(console.error);
          }
          untagged++;
        }
      }

      await sleep(100);
    }

    console.log(`✅ Scan terminé : ${tagged} inactifs | ${untagged} réactivés | ${kickAlerts} alertes expulsion\n`);
    await sendReport(guild, tagged, untagged, kickAlerts, inactiveList);

  } catch (err) {
    console.error('Erreur lors du scan :', err.message || err);
  }
}

/**
 * Envoie une alerte dans les logs avec boutons Expulser / Ignorer
 */
async function sendKickAlert(guild, member, daysInactive) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  console.log(`⚠️  Alerte expulsion : ${member.user.tag} (${daysInactive}j)`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`kick_${member.id}`)
      .setLabel('👢 Expulser')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ignore_${member.id}`)
      .setLabel('✅ Ignorer')
      .setStyle(ButtonStyle.Secondary),
  );

  await logChannel.send({
    embeds: [{
      title: '⚠️ Membre inactif depuis +60 jours',
      color: 0xE74C3C,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: 'Membre',          value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'Inactif depuis',  value: `**${daysInactive} jours**`, inline: true },
        { name: 'Sur le serveur depuis', value: member.joinedAt?.toLocaleDateString('fr-FR') ?? '?', inline: true },
      ],
      footer: { text: 'Atlas Security Bot — Choisissez une action' },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  }).catch(console.error);
}

async function fetchLastActivity(guild, activeMemberIds) {
  const lastActivity = new Map();
  for (const id of activeMemberIds) {
    lastActivity.set(id, Date.now());
  }

  const channels = guild.channels.cache.filter(c => c.isTextBased() && c.viewable);
  const cutoff = Date.now() - KICK_MS;
  console.log(`📂 Analyse de ${channels.size} salons (${KICK_DAYS} derniers jours)...`);

  for (const [, channel] of channels) {
    try {
      let lastId = null;
      let reachedCutoff = false;

      for (let page = 0; page < 30 && !reachedCutoff; page++) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const [, msg] of messages) {
          if (msg.author.bot) continue;
          if (msg.createdTimestamp < cutoff) { reachedCutoff = true; break; }
          const existing = lastActivity.get(msg.author.id);
          if (!existing || msg.createdTimestamp > existing) {
            lastActivity.set(msg.author.id, msg.createdTimestamp);
          }
        }

        lastId = messages.last()?.id;
        await sleep(300);
      }
    } catch { }
  }

  return lastActivity;
}

async function sendReport(guild, tagged, untagged, kickAlerts, inactiveList) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const inactivePreview = inactiveList.slice(0, 15).join('\n') || '_Aucun_';
  const inactiveExtra   = inactiveList.length > 15 ? `\n_...et ${inactiveList.length - 15} autres_` : '';

  await logChannel.send({
    embeds: [{
      title: `📋 Rapport hebdomadaire — Activité membres`,
      description: `Scan effectué le **${now}**`,
      color: 0xE74C3C,
      fields: [
        { name: '🟡 Tagués inactifs (15j+)', value: `${tagged}`,     inline: true },
        { name: '🟢 Réactivés',              value: `${untagged}`,   inline: true },
        { name: '⚠️ Alertes expulsion (60j+)', value: `${kickAlerts}`, inline: true },
        { name: `🟡 Liste inactifs (${inactiveList.length})`, value: inactivePreview + inactiveExtra },
      ],
      footer: { text: 'Atlas Security Bot' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

module.exports = { scanInactiveMembers };
