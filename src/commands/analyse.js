const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const activity = require('../activity');
const { getMemberStatus, getDaysInactive, INACTIVE_DAYS, EXPEL_DAYS } = activity;
const db = require('../database');
require('dotenv').config();

const EXCLUDED_ROLE_IDS = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);
const INACTIVE_ROLE_ID  = process.env.INACTIVE_ROLE_ID;
const ACTIVE_ROLE_ID    = process.env.ACTIVE_ROLE_ID;
const LOG_CHANNEL_ID    = process.env.LOG_CHANNEL_ID;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runAnalysis(guild) {
  const inactiveRole = guild.roles.cache.get(INACTIVE_ROLE_ID);
  const activeRole   = ACTIVE_ROLE_ID ? guild.roles.cache.get(ACTIVE_ROLE_ID) : null;
  if (!inactiveRole) return null;

  // Récupérer membres avec retry
  let members;
  for (let i = 0; i < 3; i++) {
    try {
      members = await guild.members.fetch();
      break;
    } catch (err) {
      if (err.data?.retry_after && i < 2) {
        const wait = (err.data.retry_after + 2) * 1000;
        console.log('⏳ Rate limit — attente ' + Math.ceil(wait / 1000) + 's...');
        await sleep(wait);
      } else throw err;
    }
  }

  await activity.refresh();

  let newInactive = 0, newActive = 0, toExpel = 0;
  const inactiveList = [], expelList = [];

  for (const [, member] of members) {
    if (member.user.bot) continue;
    if (EXCLUDED_ROLE_IDS.some(id => member.roles.cache.has(id))) continue;

    const status = getMemberStatus(member);
    const days   = getDaysInactive(member);

    if (status === 'active' || status === 'new') {
      if (member.roles.cache.has(INACTIVE_ROLE_ID)) {
        await member.roles.remove(inactiveRole).catch(() => {});
        if (activeRole && !member.roles.cache.has(ACTIVE_ROLE_ID)) {
          await member.roles.add(activeRole).catch(() => {});
        }
        newActive++;
      }
      await db.upsertMember(member.user, { status: 'active' });

    } else if (status === 'inactive' || status === 'expel') {
      if (!member.roles.cache.has(INACTIVE_ROLE_ID)) {
        const rolesToRemove = member.roles.cache.filter(r =>
          r.id !== guild.id && r.id !== INACTIVE_ROLE_ID && r.editable
        );
        for (const [, role] of rolesToRemove) {
          await member.roles.remove(role).catch(() => {});
          await sleep(200);
        }
        await member.roles.add(inactiveRole).catch(() => {});
        newInactive++;
      }
      await db.upsertMember(member.user, { status: 'inactive' });
      inactiveList.push('<@' + member.id + '> — ' + days + 'j');

      if (status === 'expel') {
        toExpel++;
        expelList.push('<@' + member.id + '> — ' + days + 'j');
      }
    }

    await sleep(100);
  }

  return { newInactive, newActive, toExpel, inactiveList, expelList };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analyse')
    .setDescription('Lance l\'analyse manuelle des membres actifs/inactifs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await runAnalysis(interaction.guild);

      if (!result) {
        await interaction.editReply({ content: '❌ Rôle Inactif introuvable.' });
        return;
      }

      const { newInactive, newActive, toExpel, inactiveList, expelList } = result;
      console.log('✅ Analyse terminée : ' + newInactive + ' inactifs | ' + newActive + ' réactivés | ' + toExpel + ' à expulser');

      // Log rapport dans le salon logs
      if (LOG_CHANNEL_ID) {
        const logCh = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logCh) {
          const inactivePreview = inactiveList.slice(0, 15).join('\n') || '_Aucun_';
          const expelPreview    = expelList.slice(0, 10).join('\n')    || '_Aucun_';
          const inactiveExtra   = inactiveList.length > 15 ? '\n_...et ' + (inactiveList.length - 15) + ' autres_' : '';
          const expelExtra      = expelList.length > 10  ? '\n_...et ' + (expelList.length - 10)  + ' autres_' : '';

          await logCh.send({
            embeds: [{
              title: '📊 Rapport /analyse — ' + new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
              color: 0x5865F2,
              fields: [
                { name: '🟡 Nouveaux inactifs (+' + INACTIVE_DAYS + 'j)', value: '' + newInactive, inline: true },
                { name: '✅ Réactivés',                                    value: '' + newActive,   inline: true },
                { name: '⚠️ À expulser (+' + EXPEL_DAYS + 'j)',           value: '' + toExpel,     inline: true },
                { name: '🟡 Liste inactifs (' + inactiveList.length + ')', value: inactivePreview + inactiveExtra },
                { name: '⚠️ Liste expulsion (' + expelList.length + ')',   value: expelPreview + expelExtra },
              ],
              footer: { text: 'Damoclès Security Bot' },
              timestamp: new Date().toISOString(),
            }]
          }).catch(() => {});
        }
      }

      // Mettre à jour le status-bot
      const { updateStatusMessage } = require('../statusbot');
      await updateStatusMessage(interaction.client, true);

      // Log dans damocles-log
      const { log } = require('../logger');
      await log(interaction.client, 'analyse_done', { inactive: newInactive, reactivated: newActive, toExpel });

      await interaction.editReply({
        content: '✅ Analyse terminée !\n🟡 **' + newInactive + '** nouveaux inactifs\n✅ **' + newActive + '** réactivés\n⚠️ **' + toExpel + '** à expulser',
      });

    } catch (err) {
      console.error('Erreur analyse :', err.message);
      try { await interaction.editReply({ content: '❌ Erreur : ' + err.message }); } catch {}
    }
  },

  // Appelée par le cron quotidien
  async runAuto(guild) {
    try {
      const result = await runAnalysis(guild);
      if (!result) return null;
      console.log('✅ Analyse auto : ' + result.newInactive + ' inactifs | ' + result.newActive + ' réactivés | ' + result.toExpel + ' à expulser');
      return { inactive: result.newInactive, reactivated: result.newActive, toExpel: result.toExpel };
    } catch (err) {
      console.error('Erreur analyse auto :', err.message);
      return null;
    }
  },
};
