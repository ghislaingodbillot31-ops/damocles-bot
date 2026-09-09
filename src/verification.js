const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const { SEP } = require('./embed-format');
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
  await db.upsertMember(member.user, {
    joinedAt: member.joinedAt?.toISOString(),
    verifiedAt: new Date().toISOString(),
    verificationResult: failed.length === 0 ? 'ok' : 'failed',
    verificationChecks: checks,
  });

  if (!verifChannel) return;

  // Un seul embed à largeur fixe, édité check par check (effet « console »).
  const lignes = [];
  let msg = null;
  const render = async (color = 0x2F3136, components) => {
    const payload = {
      embeds: [{
        title: '🖥️ DAMOCLES SECURITY SYSTEM v2.0',
        description: [SEP, ...lignes].join('\n'),
        color,
      }],
    };
    if (components) payload.components = components;
    try { if (msg) await msg.edit(payload); else msg = await verifChannel.send(payload); } catch {}
  };

  lignes.push('**Cible :** `' + member.user.tag + '` (`' + member.user.id + '`)');
  await render();
  await sleep(800);

  // Afficher chaque check
  for (const check of checks) {
    const label = check.label;
    const dots  = '.'.repeat(Math.max(2, 32 - label.length));
    let line;

    if (check.type === 'oui_non') {
      line = '`▶` ' + label + ' ' + dots + ' ' + (check.value ? '🟠 **Oui**' : '🟢 **Non**');
      if (check.value && check.detail) line += '\n> ' + check.detail;
    } else if (check.type === 'danger') {
      line = '`▶` ' + label + ' ' + dots + ' ' + (check.value ? '🔴 **Oui**' : '🟢 **Non**');
      if (check.value && check.detail) line += '\n> ' + check.detail;
    } else {
      const icon   = check.passed ? '✅' : '❌';
      const status = check.passed ? 'OK' : 'ÉCHEC';
      line = '`▶` ' + label + ' ' + dots + ' ' + icon + ' **' + status + '**';
      if (!check.passed && check.detail) line += '\n> ⚠️ ' + check.detail;
    }

    lignes.push(line);
    await render();
    await sleep(600);
  }

  await sleep(500);
  lignes.push(SEP);

  if (failed.length === 0) {
    lignes.push('✅ **Vérification complète — Accès accordé**');
    lignes.push('Bienvenue <@' + member.id + '> ! Rends-toi dans le salon **#règlement** pour accéder au serveur.');
    await render(0x2ECC71);

    // Retirer rôle Vérification → donner En attente (accès au règlement)
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (ATTENTE_ROLE_ID)      await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});
    console.log('✅ Vérification OK : ' + member.user.tag);

  } else {
    // ❌ ÉCHEC → rôle Attente admin + boutons
    if (ATTENTE_ROLE_ID) await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_accept_' + member.id).setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('verify_refuse_' + member.id).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    );

    lignes.push('⛔ **Vérification échouée**');
    lignes.push('<@' + member.id + '>, un administrateur va traiter ton intégration.');
    lignes.push('**Raisons :**');
    lignes.push(failed.map(c => '• ' + c.label + (c.detail ? ' — ' + c.detail : '')).join('\n'));
    await render(0xE74C3C, [row]);

    // Enregistrer l'échec en DB
    await db.upsertMember(member.user, { status: 'pending_admin' });
    console.log('⛔ Vérification ÉCHOUÉE : ' + member.user.tag);
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────
async function runChecks(member) {
  const user    = member.user;
  const ageDays = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
  const record  = await db.getMember(user.id);
  const checks  = [];

  // db.upsertMember() (dans le handler GuildMemberAdd) a déjà remis record.status
  // à 'active' avant qu'on arrive ici — on ne peut donc PAS s'y fier pour détecter
  // un passé sur le serveur. On lit à la place des signaux non écrasés par l'upsert :
  //   - visits (incrémenté à chaque retour)
  //   - l'historique d'événements
  //   - kickedAt / bannedAt (jamais remis à zéro par l'upsert)
  const hist       = Array.isArray(record?.history) ? record.history : [];
  const hasEvent   = (...names) => hist.some(h => names.includes(h.event));
  const lastEvent  = (name) => hist.filter(h => h.event === name).pop() || null;
  const visits     = record?.visits || 1;
  const fmtDate    = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '?');

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

  // 3. Ancien membre — a-t-il déjà été sur le serveur ?
  const dejaVenu = !!record && (visits > 1 || hasEvent('leave', 'kick', 'rejoin', 'sync_absent', 'sync_rejoin'));
  checks.push({
    label: '🔁 Ancien membre', type: 'oui_non',
    value: dejaVenu, passed: true,
    detail: dejaVenu ? visits + ' passage(s) sur le serveur' : null,
  });

  // 4. Sanctions
  const hasWarnings = !!(record && record.warnings?.length > 0);
  checks.push({
    label: '⚠️ Sanctions', type: 'oui_non',
    value: hasWarnings, passed: !hasWarnings,
    detail: hasWarnings ? record.warnings.length + ' avertissement(s)' : null,
  });

  // 5. Expulsions — déjà expulsé du serveur ?
  const kickEvt   = lastEvent('kick');
  const wasKicked = !!kickEvt || !!record?.kickedAt || record?.status === 'kicked';
  checks.push({
    label: '👢 Expulsions', type: 'oui_non',
    value: wasKicked, passed: !wasKicked,
    detail: wasKicked
      ? 'Expulsé le ' + fmtDate(kickEvt?.date || record?.kickedAt) + ' — ' + (kickEvt?.detail || 'Aucune raison')
      : null,
  });

  // 6. Départ volontaire — déjà parti de lui-même ?
  const leaveEvt = lastEvent('leave') || lastEvent('sync_absent');
  const leftVol  = !!leaveEvt || record?.status === 'left';
  checks.push({
    label: '🚪 Départ volontaire', type: 'oui_non',
    value: leftVol, passed: true,
    detail: leftVol ? 'Déjà parti le ' + fmtDate(leaveEvt?.date || record?.leftAt) : null,
  });

  // 7. Banni — présent dans la liste des bannis ?
  const banEvt   = lastEvent('ban');
  const isBanned = !!banEvt || !!record?.bannedAt || record?.status === 'banned';
  checks.push({
    label: '🔨 Banni', type: 'danger',
    value: isBanned, passed: !isBanned,
    detail: isBanned
      ? 'Banni le ' + fmtDate(record?.bannedAt || banEvt?.date) + ' — ' + (record?.banReason || banEvt?.detail || '?')
      : null,
  });

  // 8. Compte suspect — ID déjà sanctionné (kick ou ban) ?
  const isSuspect = wasKicked || isBanned;
  checks.push({
    label: '🕵️ Compte suspect', type: 'danger',
    value: isSuspect, passed: !isSuspect,
    detail: isSuspect ? 'ID déjà sanctionné sur le serveur (kick / ban)' : null,
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

    await db.upsertMember(member.user, { status: 'active', adminAccepted: true, adminAcceptedBy: interaction.user.tag, adminAcceptedAt: new Date().toISOString() });

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
        await db.kickMember(member.user, 'Refusé par l\'administration', interaction.user.tag);
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

module.exports = { verifyMember, handleVerifyButton, runChecks };