const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
require('dotenv').config();

const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID;
const REGLEMENT_ROLE_ID       = process.env.REGLEMENT_ROLE_ID;
const ATTENTE_ROLE_ID         = process.env.ATTENTE_ROLE_ID;
const TICKET_SUPPORT_ROLE_ID  = process.env.TICKET_SUPPORT_ROLE_ID;
const TICKET_CATEGORY_ID      = process.env.TICKET_CATEGORY_ID;
const MIN_ACCOUNT_AGE_DAYS    = 7;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Vérification d'un nouveau membre ─────────────────────────────────────────
async function verifyMember(member) {
  const verifChannel = member.guild.channels.cache.get(VERIFICATION_CHANNEL_ID);
  const checks = await runChecks(member);
  const failed  = checks.filter(c => !c.passed);

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

  // Afficher chaque check
  for (const check of checks) {
    if (!verifChannel) continue;
    const label = check.label;
    const dots  = '.'.repeat(Math.max(2, 32 - label.length));
    let text, color;

    if (check.type === 'oui_non') {
      text  = '`▶` ' + label + ' ' + dots + ' ' + (check.value ? '🟠 **Oui**' : '🟢 **Non**');
      if (check.value && check.detail) text += '\n> ' + check.detail;
      color = check.value ? 0xE67E22 : 0x2ECC71;
    } else if (check.type === 'danger') {
      text  = '`▶` ' + label + ' ' + dots + ' ' + (check.value ? '🔴 **Oui**' : '🟢 **Non**');
      if (check.value && check.detail) text += '\n> ' + check.detail;
      color = check.value ? 0xE74C3C : 0x2ECC71;
    } else {
      const icon   = check.passed ? '✅' : '❌';
      const status = check.passed ? 'OK' : 'ÉCHEC';
      text  = '`▶` ' + label + ' ' + dots + ' ' + icon + ' **' + status + '**';
      if (!check.passed && check.detail) text += '\n> ⚠️ ' + check.detail;
      color = check.passed ? 0x2ECC71 : 0xE74C3C;
    }

    await verifChannel.send({ embeds: [{ description: text, color }] });
    await sleep(600);
  }

  await sleep(500);

  if (failed.length === 0) {
    // ✅ Vérification OK → rôle Règlement
    if (verifChannel) {
      await verifChannel.send({
        embeds: [{
          description: [
            '✅ **Vérification complète — Accès accordé**',
            '> Bienvenue <@' + member.id + '> !',
            '> Rends-toi dans le salon règlement pour accéder au serveur.',
          ].join('\n'),
          color: 0x2ECC71,
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }]
      });
    }
    if (ATTENTE_ROLE_ID)  await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID) await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
    console.log('✅ Vérification OK : ' + member.user.tag);

  } else {
    // ❌ Vérification ÉCHOUÉE → ticket automatique
    if (verifChannel) {
      await verifChannel.send({
        embeds: [{
          description: [
            '⛔ **Vérification échouée**',
            '> <@' + member.id + '>, ta demande a été signalée.',
            '> Un ticket a été ouvert automatiquement pour te permettre de te justifier.',
            '> Merci de patienter dans ce salon.',
          ].join('\n'),
          color: 0xE74C3C,
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }]
      });
    }
    console.log('⛔ Vérification ÉCHOUÉE : ' + member.user.tag);
    await openFailTicket(member, failed);
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────
async function runChecks(member) {
  const user    = member.user;
  const ageDays = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
  const record  = db.getMember(user.id);
  const checks  = [];

  // 1. Pseudo conforme
  const pseudoOk = /^[a-zA-Z0-9_\-\. \u00C0-\u024F]+$/.test(user.username);
  checks.push({
    label: '🔤 Pseudo', type: 'classic',
    passed: pseudoOk,
    detail: pseudoOk ? null : 'Pseudo suspect : ' + user.username,
  });

  // 2. Âge du compte
  checks.push({
    label: '📅 Âge du compte', type: 'classic',
    passed: ageDays >= MIN_ACCOUNT_AGE_DAYS,
    detail: 'Créé il y a ' + ageDays + ' jour(s)',
  });

  // 3. Ancien membre
  const isFormer = record && ['left','kicked','active'].includes(record.status);
  checks.push({
    label: '🔁 Ancien membre', type: 'oui_non',
    value: !!isFormer, passed: true,
    detail: isFormer ? 'Statut : ' + record.status : null,
  });

  // 4. Sanctions
  const hasWarnings = record && record.warnings?.length > 0;
  checks.push({
    label: '⚠️ Sanctions', type: 'oui_non',
    value: !!hasWarnings, passed: !hasWarnings,
    detail: hasWarnings ? record.warnings.length + ' avertissement(s)' : null,
  });

  // 5. Expulsions
  const wasKicked = record && record.status === 'kicked';
  const kickReason = wasKicked && record.history
    ? (record.history.filter(h => h.event === 'kick').pop()?.detail || 'Aucune raison')
    : null;
  checks.push({
    label: '👢 Expulsions', type: 'oui_non',
    value: !!wasKicked, passed: !wasKicked,
    detail: wasKicked ? 'Expulsé le ' + new Date(record.kickedAt).toLocaleDateString('fr-FR') + ' — ' + kickReason : null,
  });

  // 6. Départ volontaire
  const leftVol = record && record.status === 'left';
  checks.push({
    label: '🚪 Départ volontaire', type: 'oui_non',
    value: !!leftVol, passed: true,
    detail: leftVol ? 'Quitté le ' + new Date(record.leftAt).toLocaleDateString('fr-FR') : null,
  });

  // 7. Banni
  const isBanned = record && record.status === 'banned';
  checks.push({
    label: '🔨 Banni', type: 'danger',
    value: !!isBanned, passed: !isBanned,
    detail: isBanned ? 'Banni le ' + new Date(record.bannedAt).toLocaleDateString('fr-FR') + ' — ' + (record.banReason || '?') : null,
  });

  // 8. Compte suspect
  const isSuspect = record && ['banned','kicked'].includes(record.status);
  checks.push({
    label: '🕵️ Compte suspect', type: 'danger',
    value: !!isSuspect, passed: !isSuspect,
    detail: isSuspect ? 'ID connu — statut : ' + record.status : null,
  });

  return checks;
}

// ── Ticket automatique en cas d'échec ─────────────────────────────────────────
async function openFailTicket(member, failedChecks) {
  const guild = member.guild;
  const channelName = 'ticket-' + member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  if (TICKET_SUPPORT_ROLE_ID) {
    permissionOverwrites.push({
      id: TICKET_SUPPORT_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  try {
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: 'Ticket vérification — ' + member.user.tag + ' | ID: ' + member.id,
      parent: TICKET_CATEGORY_ID || null,
      permissionOverwrites,
    });

    const reasons = failedChecks.map(c => '• ' + c.label + (c.detail ? ' — ' + c.detail : '')).join('\n');

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

    await ticketChannel.send({
      content: TICKET_SUPPORT_ROLE_ID ? '<@&' + TICKET_SUPPORT_ROLE_ID + '>' : '',
      embeds: [{
        title: '⛔ Vérification échouée — Action requise',
        color: 0xE74C3C,
        thumbnail: { url: member.user.displayAvatarURL() },
        fields: [
          { name: '👤 Membre', value: '<@' + member.id + '>\n`' + member.user.tag + '`\nID : `' + member.user.id + '`', inline: true },
          { name: '📅 Compte créé', value: new Date(member.user.createdTimestamp).toLocaleDateString('fr-FR'), inline: true },
          { name: '❌ Raisons', value: reasons },
        ],
        footer: { text: 'Damoclès Security Bot — Action requise' },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
    });

    // Message au membre
    await ticketChannel.send({
      embeds: [{
        description: '<@' + member.id + '>\n\nTa vérification a échoué. Tu peux te justifier ici.\nUn responsable examinera ta demande.',
        color: 0xE67E22,
        footer: { text: 'Damoclès Security Bot' },
      }]
    });

    console.log('🎫 Ticket vérification créé : ' + channelName);
  } catch (err) {
    console.error('❌ Erreur ticket vérification :', err.message);
  }
}

// ── Boutons de décision staff ──────────────────────────────────────────────────
async function handleVerifyButton(interaction) {
  const parts    = interaction.customId.split('_');
  const action   = parts[1];
  const memberId = parts[2];
  const guild    = interaction.guild;
  const member   = await guild.members.fetch(memberId).catch(() => null);

  if (action === 'accept') {
    if (!member) {
      await interaction.update({ embeds: [{ description: '❌ Membre introuvable.', color: 0x95A5A6 }], components: [] });
      return;
    }
    if (ATTENTE_ROLE_ID)   await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID) await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});

    await interaction.update({
      embeds: [{ description: '✅ **Accepté** par ' + interaction.user.tag + '\n<@' + memberId + '> a accès au règlement.', color: 0x2ECC71, timestamp: new Date().toISOString() }],
      components: [],
    });

    // Supprimer le ticket après 10s
    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
    console.log('✅ ' + memberId + ' accepté par ' + interaction.user.tag);
  }

  if (action === 'refuse') {
    await interaction.update({
      embeds: [{ description: '❌ **Refusé** par ' + interaction.user.tag + '\nLe membre reste en attente.', color: 0xE67E22, timestamp: new Date().toISOString() }],
      components: [],
    });
    console.log('❌ ' + memberId + ' refusé par ' + interaction.user.tag);
  }

  if (action === 'ban') {
    try {
      await guild.members.ban(memberId, { reason: 'Refusé lors de la vérification par ' + interaction.user.tag });
      if (member) db.banMember(member.user, 'Refusé à la vérification', interaction.user.tag);
      await interaction.update({
        embeds: [{ description: '🔨 **Banni** par ' + interaction.user.tag, color: 0xE74C3C, timestamp: new Date().toISOString() }],
        components: [],
      });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    } catch (err) {
      await interaction.reply({ content: '❌ Impossible de bannir : ' + err.message, ephemeral: true });
    }
  }
}

module.exports = { verifyMember, handleVerifyButton };
