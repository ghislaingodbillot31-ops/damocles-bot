const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
let _client = null;
function setClient(c) { _client = c; }
require('dotenv').config();

const VERIFICATION_ROLE_ID    = process.env.VERIFICATION_ROLE_ID;
const REGLEMENT_ROLE_ID       = process.env.REGLEMENT_ROLE_ID;
const ATTENTE_ROLE_ID         = process.env.ATTENTE_ROLE_ID;
const ATTENTE_CHANNEL_ID      = process.env.ATTENTE_CHANNEL_ID;
const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID;
const MIN_ACCOUNT_AGE_DAYS    = 30;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function verifyMember(member) {
  const checks = await runChecks(member);
  const failed = checks.filter(c => !c.passed);
  const verifChannel = member.guild.channels.cache.get(VERIFICATION_CHANNEL_ID);

  // Message d'intro
  if (verifChannel) {
    await verifChannel.send({
      embeds: [{
        description: [
          '> 🖥️ **DAMOCLES SECURITY SYSTEM v2.0**',
          '> Initialisation de la vérification...',
          '> Cible : `' + member.user.tag + '` (`' + member.user.id + '`)',
        ].join('\n'),
        color: 0x2F3136,
      }]
    });
    await sleep(800);
  }

  // Afficher chaque contrôle un par un
  for (const check of checks) {
    if (verifChannel) {
      const icon   = check.passed ? '✅' : '❌';
      const status = check.passed ? 'OK' : 'ÉCHEC';
      const label  = check.label;
      const dots   = '.'.repeat(Math.max(2, 32 - label.length));
      const detail = !check.passed ? '\n> ⚠️ ' + check.detail : '';

      await verifChannel.send({
        embeds: [{
          description: '`▶` ' + label + ' ' + dots + ' ' + icon + ' **' + status + '**' + detail,
          color: check.passed ? 0x2ECC71 : 0xE74C3C,
        }]
      });
      await sleep(600);
    }
  }

  await sleep(500);

  // Résultat final
  if (failed.length === 0) {
    if (verifChannel) {
      await verifChannel.send({
        embeds: [{
          description: [
            '✅ **Vérification complète — Accès accordé**',
            '> Bienvenue <@' + member.id + '> !',
            '> Tu vas être redirigé vers le règlement.',
          ].join('\n'),
          color: 0x2ECC71,
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }]
      });
    }
    await acceptMember(member);
  } else {
    if (verifChannel) {
      await verifChannel.send({
        embeds: [{
          description: [
            '⛔ **Vérification échouée — Accès refusé**',
            '> Ta demande a été transmise à un administrateur.',
            '> Merci de patienter dans ce salon.',
          ].join('\n'),
          color: 0xE74C3C,
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }]
      });
    }
    await flagMember(member, checks, failed);
  }
}

async function runChecks(member) {
  const user    = member.user;
  const ageDays = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
  const record  = db.getMember(user.id);
  const checks  = [];

  // 1. Pseudo conforme
  const pseudoOk = /^[a-zA-Z0-9_\-\. \u00C0-\u024F\u4E00-\u9FFF]+$/.test(user.username);
  checks.push({
    label:  '🔤 Pseudo',
    passed: pseudoOk,
    detail: pseudoOk ? user.username : 'Pseudo suspect : ' + user.username,
  });

  // 2. Compte +30 jours
  checks.push({
    label:  '📅 Âge du compte',
    passed: ageDays >= MIN_ACCOUNT_AGE_DAYS,
    detail: 'Créé il y a ' + ageDays + ' jours (' + new Date(user.createdTimestamp).toLocaleDateString('fr-FR') + ')',
  });

  // 3. Ancien membre
  const isFormerMember = record && (record.status === 'left' || record.status === 'kicked');
  checks.push({
    label:  '🔁 Ancien membre',
    passed: true,
    detail: isFormerMember
      ? 'Ancien membre — statut : ' + record.status
      : 'Premier passage sur le serveur',
  });

  // 4. Historique sanctions
  const hasWarnings = record && record.warnings?.length > 0;
  checks.push({
    label:  '⚠️ Sanctions',
    passed: !hasWarnings,
    detail: hasWarnings
      ? record.warnings.length + ' avertissement(s) enregistré(s)'
      : 'Aucun avertissement',
  });

  // 5. Historique expulsions
  const wasKicked = record && record.status === 'kicked';
  checks.push({
    label:  '👢 Expulsions',
    passed: !wasKicked,
    detail: wasKicked
      ? 'Expulsé le ' + new Date(record.kickedAt).toLocaleDateString('fr-FR')
      : 'Aucune expulsion',
  });

  // 6. Départ volontaire
  const leftVoluntarily = record && record.status === 'left';
  checks.push({
    label:  '🚪 Départ volontaire',
    passed: true,
    detail: leftVoluntarily
      ? 'A quitté le ' + new Date(record.leftAt).toLocaleDateString('fr-FR')
      : 'Aucun départ enregistré',
  });

  // 7. Banni
  const isBanned = record && record.status === 'banned';
  checks.push({
    label:  '🔨 Banni',
    passed: !isBanned,
    detail: isBanned
      ? 'Banni le ' + new Date(record.bannedAt).toLocaleDateString('fr-FR') + ' — ' + record.banReason
      : 'Non banni',
  });

  // 8. Compte suspect (ID connu banni/expulsé)
  const isSuspect = record && (record.status === 'banned' || record.status === 'kicked');
  checks.push({
    label:  '🕵️ Compte suspect',
    passed: !isSuspect,
    detail: isSuspect
      ? 'ID connu en base — statut : ' + record.status
      : 'Aucune correspondance suspecte',
  });

  return checks;
}

async function acceptMember(member) {
  try {
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
    console.log('✅ Vérification OK : ' + member.user.tag + ' → rôle Règlement');
  if (_client) { const { log } = require('./logger'); await log(_client, 'verification_ok', { userId: member.id }); }
  } catch (err) {
    console.error('Erreur acceptMember :', err.message);
  }
}

async function flagMember(member, allChecks, failedChecks) {
  try {
    if (ATTENTE_ROLE_ID) await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});
    console.log('⛔ Vérification ÉCHOUÉE : ' + member.user.tag);
  if (_client) { const { log } = require('./logger'); await log(_client, 'verification_failed', { userId: member.id, reasons: failedChecks.map(c => c.label).join(', ') }); }

    const channel = member.guild.channels.cache.get(ATTENTE_CHANNEL_ID);
    if (!channel) return;

    const record  = db.getMember(member.user.id);
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);

    const checkSummary = allChecks.map(c =>
      (c.passed ? '✅' : '❌') + ' **' + c.label + '**\n└ ' + c.detail
    ).join('\n\n');

    let historyText = '_Aucun historique_';
    if (record?.history?.length) {
      historyText = record.history.slice(-10).map(h =>
        '• ' + new Date(h.date).toLocaleDateString('fr-FR') + ' — **' + h.event + '**' + (h.detail ? ' (' + h.detail + ')' : '')
      ).join('\n');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_accept_' + member.id)
        .setLabel('✅ Accepter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('verify_refuse_' + member.id)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('verify_ban_' + member.id)
        .setLabel('🔨 Bannir')
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({
      embeds: [{
        title: '⛔ Vérification échouée — Action requise',
        color: 0xE74C3C,
        thumbnail: { url: member.user.displayAvatarURL() },
        fields: [
          { name: '👤 Membre', value: '<@' + member.id + '>\n`' + member.user.tag + '`\nID : `' + member.user.id + '`', inline: true },
          { name: '📅 Compte créé', value: new Date(member.user.createdTimestamp).toLocaleDateString('fr-FR') + '\n(' + ageDays + ' jours)', inline: true },
          { name: '📋 Contrôles', value: checkSummary },
          { name: '📜 Historique DB', value: historyText },
        ],
        footer: { text: 'Damoclès Security Bot — Décision requise' },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
    });

  } catch (err) {
    console.error('Erreur flagMember :', err.message);
  }
}

async function handleVerifyButton(interaction) {
  const parts    = interaction.customId.split('_');
  const action   = parts[1];
  const memberId = parts[2];
  const guild    = interaction.guild;
  const member   = await guild.members.fetch(memberId).catch(() => null);
  const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID;

  if (action === 'accept') {
    if (!member) {
      await interaction.update({ embeds: [{ description: '❌ Membre introuvable.', color: 0x95A5A6 }], components: [] });
      return;
    }
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (ATTENTE_ROLE_ID)      await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});

    await interaction.update({
      embeds: [{
        description: '✅ **Accepté** par ' + interaction.user.tag + '\n<@' + memberId + '> a reçu le rôle Règlement.',
        color: 0x2ECC71,
        footer: { text: 'Damoclès Security Bot' },
        timestamp: new Date().toISOString(),
      }],
      components: [],
    });
    console.log('✅ ' + memberId + ' accepté par ' + interaction.user.tag);
  }

  if (action === 'refuse') {
    const verifChannel = guild.channels.cache.get(VERIFICATION_CHANNEL_ID);
    if (verifChannel && member) {
      await verifChannel.send({
        content: '<@' + memberId + '>',
        embeds: [{
          description: "Ta vérification a échoué, l'admin a refusé ton adhésion.\nMerci de bien vouloir quitter le Discord Atlas.",
          color: 0xE74C3C,
          footer: { text: 'Damoclès Security Bot' },
        }],
      });
    }
    await interaction.update({
      embeds: [{
        description: '❌ **Refusé** par ' + interaction.user.tag + '\nMessage envoyé dans #verification.',
        color: 0xE67E22,
        footer: { text: 'Damoclès Security Bot' },
        timestamp: new Date().toISOString(),
      }],
      components: [],
    });
  }

  if (action === 'ban') {
    try {
      const user = member?.user || await interaction.client.users.fetch(memberId).catch(() => null);
      await guild.members.ban(memberId, { reason: 'Banni lors de la vérification par ' + interaction.user.tag });
      if (user) db.banMember(user, 'Banni lors de la vérification', interaction.user.tag);
      await interaction.update({
        embeds: [{
          description: '🔨 **Banni** par ' + interaction.user.tag,
          color: 0xE74C3C,
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }],
        components: [],
      });
    } catch (err) {
      await interaction.reply({ content: '❌ Impossible de bannir : ' + err.message, ephemeral: true });
    }
  }
}

module.exports = { verifyMember, handleVerifyButton, setClient };
