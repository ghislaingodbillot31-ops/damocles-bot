const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
require('dotenv').config();

const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID; // 1538533245938040853
const VERIFICATION_ROLE_ID    = process.env.VERIFICATION_ROLE_ID;
const REGLEMENT_ROLE_ID       = process.env.REGLEMENT_ROLE_ID;
const ATTENTE_ROLE_ID         = process.env.ATTENTE_ROLE_ID;
const ACTIVE_ROLE_ID          = process.env.ACTIVE_ROLE_ID; // Membres validé
const MIN_ACCOUNT_AGE_DAYS    = 7;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Vérification principale ───────────────────────────────────────────────────
async function verifyMember(member) {
  const verifChannel = member.guild.channels.cache.get(VERIFICATION_CHANNEL_ID);
  const checks = await runChecks(member);
  const failed  = checks.filter(c => !c.passed);

  // Enregistrer en DB
  db.upsertMember(member.user, {
    joinedAt: member.joinedAt?.toISOString(),
    verifiedAt: new Date().toISOString(),
    verificationResult: failed.length === 0 ? 'ok' : 'failed',
    verificationChecks: checks,
  });

  if (!verifChannel) return;

  // Message d'intro
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

  // Afficher chaque check
  for (const check of checks) {
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
    // ✅ OK → rôle Attente règlement
    await verifChannel.send({
      embeds: [{
        description: [
          '✅ **Vérification complète — Accès accordé**',
          '> Bienvenue <@' + member.id + '> !',
          '> Rends-toi dans le salon **#règlement** pour accéder au serveur.',
        ].join('\n'),
        color: 0x2ECC71,
        footer: { text: 'Damoclès Security Bot' },
        timestamp: new Date().toISOString(),
      }]
    });

    // Retirer rôle Vérification → donner Attente règlement
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
    console.log('✅ Vérification OK : ' + member.user.tag);

  } else {
    // ❌ ÉCHEC → rôle Attente admin + boutons dans #vérification
    if (ATTENTE_ROLE_ID) await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_accept_' + member.id)
        .setLabel('✅ Accepter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('verify_refuse_' + member.id)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Danger),
    );

    const reasons = failed.map(c => '• ' + c.label + (c.detail ? ' — ' + c.detail : '')).join('\n');

    await verifChannel.send({
      embeds: [{
        title: '⛔ Vérification échouée',
        description: [
          '<@' + member.id + '>, ta vérification a échoué.',
          'Merci de patienter, un administrateur va traiter ton intégration.',
          '',
          '**Raisons :**',
          reasons,
        ].join('\n'),
        color: 0xE74C3C,
        thumbnail: { url: member.user.displayAvatarURL() },
        footer: { text: 'Damoclès Security Bot — Action admin requise' },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
    });

    // Enregistrer l'échec en DB
    db.upsertMember(member.user, { status: 'pending_admin' });
    console.log('⛔ Vérification ÉCHOUÉE : ' + member.user.tag);
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
    detail: 'Créé il y a ' + ageDays + ' jour(s) — minimum ' + MIN_ACCOUNT_AGE_DAYS + 'j',
  });

  // 3. Ancien membre
  const isFormer = !!(record && ['left', 'kicked', 'active', 'inactive', 'pending_admin'].includes(record.status));
  checks.push({
    label: '🔁 Ancien membre', type: 'oui_non',
    value: isFormer, passed: true,
    detail: isFormer ? 'Déjà vu — statut : ' + record.status : null,
  });

  // 4. Sanctions
  const hasWarnings = !!(record && record.warnings?.length > 0);
  checks.push({
    label: '⚠️ Sanctions', type: 'oui_non',
    value: hasWarnings, passed: !hasWarnings,
    detail: hasWarnings ? record.warnings.length + ' avertissement(s)' : null,
  });

  // 5. Expulsions
  const wasKicked = !!(record && record.status === 'kicked');
  const kickReason = wasKicked
    ? (record.history?.filter(h => h.event === 'kick').pop()?.detail || 'Aucune raison')
    : null;
  checks.push({
    label: '👢 Expulsions', type: 'oui_non',
    value: wasKicked, passed: !wasKicked,
    detail: wasKicked ? 'Expulsé le ' + new Date(record.kickedAt).toLocaleDateString('fr-FR') + ' — ' + kickReason : null,
  });

  // 6. Départ volontaire
  const leftVol = !!(record && record.status === 'left');
  checks.push({
    label: '🚪 Départ volontaire', type: 'oui_non',
    value: leftVol, passed: true,
    detail: leftVol ? 'Quitté le ' + new Date(record.leftAt).toLocaleDateString('fr-FR') : null,
  });

  // 7. Banni
  const isBanned = !!(record && record.status === 'banned');
  checks.push({
    label: '🔨 Banni', type: 'danger',
    value: isBanned, passed: !isBanned,
    detail: isBanned
      ? 'Banni le ' + new Date(record.bannedAt).toLocaleDateString('fr-FR') + ' — ' + (record.banReason || '?')
      : null,
  });

  // 8. Compte suspect
  const isSuspect = !!(record && ['banned', 'kicked'].includes(record.status));
  checks.push({
    label: '🕵️ Compte suspect', type: 'danger',
    value: isSuspect, passed: !isSuspect,
    detail: isSuspect ? 'ID connu — statut : ' + record.status : null,
  });

  return checks;
}

// ── Handler boutons Accepter / Refuser ────────────────────────────────────────
async function handleVerifyButton(interaction) {
  const parts    = interaction.customId.split('_');
  const action   = parts[1];
  const memberId = parts[2];
  const guild    = interaction.guild;
  const member   = await guild.members.fetch(memberId).catch(() => null);

  if (action === 'accept') {
    if (!member) {
      await interaction.update({
        embeds: [{ description: '❌ Membre introuvable (a peut-être quitté).', color: 0x95A5A6 }],
        components: [],
      });
      return;
    }

    // Retirer Vérification + Attente admin → donner Attente règlement
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (ATTENTE_ROLE_ID)      await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});

    db.upsertMember(member.user, { status: 'active', adminAccepted: true, adminAcceptedBy: interaction.user.tag, adminAcceptedAt: new Date().toISOString() });

    await interaction.update({
      embeds: [{
        description: [
          '✅ **Accepté par ' + interaction.user.tag + '**',
          '<@' + memberId + '> peut maintenant accéder au règlement.',
        ].join('\n'),
        color: 0x2ECC71,
        timestamp: new Date().toISOString(),
      }],
      components: [],
    });
    console.log('✅ ' + memberId + ' accepté manuellement par ' + interaction.user.tag);
  }

  if (action === 'refuse') {
    try {
      // Kick avec raison
      if (member) {
        await member.kick('Membre refusé par l\'administration');
        db.kickMember(member.user, 'Refusé par l\'administration', interaction.user.tag);
      }

      await interaction.update({
        embeds: [{
          description: [
            '❌ **Refusé par ' + interaction.user.tag + '**',
            '<@' + memberId + '> a été expulsé du serveur.',
            '> Raison : Membre refusé par l\'administration',
          ].join('\n'),
          color: 0xE74C3C,
          timestamp: new Date().toISOString(),
        }],
        components: [],
      });
      console.log('❌ ' + memberId + ' refusé et kické par ' + interaction.user.tag);
    } catch (err) {
      await interaction.reply({ content: '❌ Erreur : ' + err.message, flags: 64 });
    }
  }
}

module.exports = { verifyMember, handleVerifyButton };
