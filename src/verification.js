const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('./database');
const { SEP } = require('./embed-format');
require('dotenv').config();

// Salon unifié « bot-status + vérification » : par défaut le même que le statut.
const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID || '1538533342150918246';
const VERIFICATION_ROLE_ID    = process.env.VERIFICATION_ROLE_ID;
const REGLEMENT_ROLE_ID       = process.env.REGLEMENT_ROLE_ID;
const ATTENTE_ROLE_ID         = process.env.ATTENTE_ROLE_ID;
const ACTIVE_ROLE_ID          = process.env.ACTIVE_ROLE_ID; // Membres validé
const SUPPORT_CATEGORY_ID     = process.env.TICKET_CATEGORY_ID || '1538533307690520586'; // 🎫 SUPPORT
const MIN_ACCOUNT_AGE_DAYS    = 7;

const AUTO_DELETE_OK_MS = 15000; // effacement du message de vérif après un succès

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
        title: '🔍 VÉRIFICATION · ' + member.user.username,
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
    lignes.push('✅ **Vérification complète · Accès accordé**');
    lignes.push('Bienvenue <@' + member.id + '> ! Rends-toi dans le salon **#règlement** pour accéder au serveur.');
    await render(0x2ECC71);

    // Retirer rôle Vérification → donner En attente (accès au règlement)
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (ATTENTE_ROLE_ID)      await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});
    console.log('✅ Vérification OK : ' + member.user.tag);

    // Le salon est commun au statut du bot : on nettoie le message une fois lu.
    if (msg) setTimeout(() => { msg.delete().catch(() => {}); }, AUTO_DELETE_OK_MS);

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
    lignes.push(failed.map(c => '• ' + c.label + (c.detail ? ' : ' + c.detail : '')).join('\n'));
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
    detail: 'Créé il y a ' + ageDays + ' jour(s) (minimum ' + MIN_ACCOUNT_AGE_DAYS + ' jours)',
  });

  // 3. Ancien membre : a-t-il déjà été sur le serveur ?
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

  // 5. Expulsions : déjà expulsé du serveur ?
  const kickEvt   = lastEvent('kick');
  const wasKicked = !!kickEvt || !!record?.kickedAt || record?.status === 'kicked';
  checks.push({
    label: '👢 Expulsions', type: 'oui_non',
    value: wasKicked, passed: !wasKicked,
    detail: wasKicked
      ? 'Expulsé le ' + fmtDate(kickEvt?.date || record?.kickedAt) + ' · ' + (kickEvt?.detail || 'Aucune raison')
      : null,
  });

  // 6. Départ volontaire : déjà parti de lui-même ?
  const leaveEvt = lastEvent('leave') || lastEvent('sync_absent');
  const leftVol  = !!leaveEvt || record?.status === 'left';
  checks.push({
    label: '🚪 Départ volontaire', type: 'oui_non',
    value: leftVol, passed: true,
    detail: leftVol ? 'Déjà parti le ' + fmtDate(leaveEvt?.date || record?.leftAt) : null,
  });

  // 7. Banni : présent dans la liste des bannis ?
  const banEvt   = lastEvent('ban');
  const isBanned = !!banEvt || !!record?.bannedAt || record?.status === 'banned';
  checks.push({
    label: '🔨 Banni', type: 'danger',
    value: isBanned, passed: !isBanned,
    detail: isBanned
      ? 'Banni le ' + fmtDate(record?.bannedAt || banEvt?.date) + ' · ' + (record?.banReason || banEvt?.detail || '?')
      : null,
  });

  // 8. Compte suspect : ID déjà sanctionné (kick ou ban) ?
  const isSuspect = wasKicked || isBanned;
  checks.push({
    label: '🕵️ Compte suspect', type: 'danger',
    value: isSuspect, passed: !isSuspect,
    detail: isSuspect ? 'ID déjà sanctionné sur le serveur (kick / ban)' : null,
  });

  return checks;
}

// ── Handler boutons Accepter / Refuser (embed de vérification) ────────────────
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

    // Salon commun au statut du bot : on efface le message une fois traité.
    setTimeout(() => { interaction.message.delete().catch(() => {}); }, 10000);
    return;
  }

  if (action === 'refuse') {
    await interaction.deferUpdate();
    try {
      const refusChannel = await ouvrirSalonRefus(interaction, member, memberId);
      if (member) {
        await db.upsertMember(member.user, { status: 'pending_admin', refusChannelId: refusChannel?.id || null });
      }
      await interaction.editReply({
        embeds: [{
          description: [
            '❌ **Refusé par ' + interaction.user.tag + '**',
            refusChannel ? 'Discussion ouverte : <#' + refusChannel.id + '>' : 'Impossible de créer le salon privé.',
          ].join('\n'),
          color: 0xE67E22,
          timestamp: new Date().toISOString(),
        }],
        components: [],
      }).catch(() => {});
      console.log('❌ ' + memberId + ' refusé par ' + interaction.user.tag + ' → salon de discussion');

      // On efface le message de vérif du salon unifié.
      setTimeout(() => { interaction.message.delete().catch(() => {}); }, 10000);
    } catch (err) {
      await interaction.followUp({ content: '❌ Erreur : ' + err.message, flags: 64 }).catch(() => {});
    }
  }
}

// ── Salon privé de refus : #refus-{pseudo} dans 🎫 SUPPORT ───────────────────
async function ouvrirSalonRefus(interaction, member, memberId) {
  const guild = interaction.guild;
  const pseudo = member?.user?.username || memberId;
  const slug = String(pseudo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'joueur';
  const chanName = 'refus-' + slug;

  // Réutiliser un salon de refus déjà ouvert pour ce joueur.
  let refusChannel = guild.channels.cache.find(c => c.name === chanName && c.parentId === SUPPORT_CATEGORY_ID);

  if (!refusChannel) {
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];
    const modRole = guild.roles.cache.find(r => /mod[eé]rat/i.test(r.name) && !r.managed);
    if (modRole) overwrites.push({ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    const adminRole = guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed);
    if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

    refusChannel = await guild.channels.create({
      name: chanName,
      type: ChannelType.GuildText,
      parent: SUPPORT_CATEGORY_ID || null,
      permissionOverwrites: overwrites,
      reason: 'Vérification refusée : discussion avec ' + pseudo,
    }).catch(() => null);
  }
  if (!refusChannel) return null;

  // Raisons de l'échec (relecture fraîche des checks).
  let raisons = '• Vérification échouée';
  if (member) {
    const failed = (await runChecks(member)).filter(c => !c.passed);
    if (failed.length) raisons = failed.map(c => '• ' + c.label + (c.detail ? ' : ' + c.detail : '')).join('\n');
  }

  const modRole = guild.roles.cache.find(r => /mod[eé]rat/i.test(r.name) && !r.managed);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verifref_accept_' + memberId).setLabel('✅ Accepter finalement').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('verifref_kick_' + memberId).setLabel('👢 Expulser').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('verifref_close_' + memberId).setLabel('🏁 Clôturer sans suite').setStyle(ButtonStyle.Secondary),
  );

  await refusChannel.send({
    content: '<@' + memberId + '>' + (modRole ? ' <@&' + modRole.id + '>' : ''),
    embeds: [{
      title: '🚫 Vérification refusée · discussion',
      description: [
        SEP,
        '**Joueur :** <@' + memberId + '> (`' + memberId + '`)',
        '**Refusé par :** <@' + interaction.user.id + '>',
        '**Raisons de l\'échec :**',
        raisons,
        SEP,
        'Explique-toi ici avec le staff. Un membre du staff tranchera ensuite :',
        '> ✅ **Accepter finalement** : accès au règlement, ce salon est supprimé',
        '> 👢 **Expulser** : le joueur est kické, ce salon est supprimé',
        '> 🏁 **Clôturer sans suite** : ce salon est supprimé, le joueur reste en attente',
      ].join('\n'),
      color: 0xE67E22,
      timestamp: new Date().toISOString(),
    }],
    components: [row],
    allowedMentions: { users: [memberId], roles: modRole ? [modRole.id] : [] },
  }).catch(() => {});

  return refusChannel;
}

// ── Handler des 3 boutons du salon de refus ──────────────────────────────────
async function handleVerifRefButton(interaction) {
  const parts    = interaction.customId.split('_'); // verifref_<action>_<memberId>
  const action   = parts[1];
  const memberId = parts[2];
  const guild    = interaction.guild;
  const channel  = interaction.channel;
  const member   = await guild.members.fetch(memberId).catch(() => null);
  const par      = interaction.user.tag;

  const cloture = (texte, color) => {
    interaction.reply({ embeds: [{ description: texte, color, timestamp: new Date().toISOString() }] }).catch(() => {});
    setTimeout(() => { channel.delete('Vérification : ' + action).catch(() => {}); }, 6000);
  };

  if (action === 'accept') {
    if (member) {
      if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
      if (ATTENTE_ROLE_ID)      await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
      if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
      await db.upsertMember(member.user, { status: 'active', adminAccepted: true, adminAcceptedBy: par, adminAcceptedAt: new Date().toISOString() });
    }
    console.log('✅ ' + memberId + ' accepté finalement par ' + par);
    cloture('✅ **Accepté par ' + par + '**\n<@' + memberId + '> a maintenant accès au règlement. Ce salon va être supprimé.', 0x2ECC71);
    return;
  }

  if (action === 'kick') {
    if (member) {
      try { await member.kick('Refusé par l\'administration'); } catch {}
      await db.kickMember(member.user, 'Refusé par l\'administration', par);
    }
    console.log('👢 ' + memberId + ' expulsé par ' + par + ' (salon de refus)');
    cloture('👢 **' + (member ? member.user.tag : memberId) + ' expulsé par ' + par + '**\nCe salon va être supprimé.', 0xE74C3C);
    return;
  }

  // close
  console.log('🏁 Salon de refus de ' + memberId + ' clôturé sans suite par ' + par);
  cloture('🏁 **Clôturé sans suite par ' + par + '**\n<@' + memberId + '> reste en attente admin. Ce salon va être supprimé.', 0x95A5A6);
}

module.exports = { verifyMember, handleVerifyButton, handleVerifRefButton, runChecks };
