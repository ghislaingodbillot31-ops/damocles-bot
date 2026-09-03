const fs   = require('fs');
const path = require('path');
const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits,
} = require('discord.js');
const exp = require('../exploitation');
const { agrilog } = require('../agrilog');

const { dataPath }    = require('../paths');
const CONTRAT_CHANNEL = '1544735442589450270';
const SESSION_PATH    = dataPath('contrat-sessions.json');

function autoClean(interaction, delay = 4000) {
  setTimeout(() => { interaction.deleteReply().catch(() => {}); }, delay);
}

// Résumé court de l'objet de l'annonce (pour le journal en une ligne)
const objetShort = data => data.kind === 'besoin'
  ? data.type + (data.quantite ? ' (' + data.quantite + ')' : '')
  : data.travail;

// ── Lance le flux de création de contrat → modale directe ───────────────────
async function startContratFlow(interaction) {
  const exploit = exp.getByOwner(interaction.user.id);
  if (!exploit) {
    await interaction.reply({ embeds: [{ description: '❌ Tu n\'as pas d\'exploitation. Crée-la depuis le **HUB des exploitants**.', color: 0xE74C3C }], flags: 64 });
    autoClean(interaction);
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('contrat_modal_' + interaction.user.id)
    .setTitle('Nouveau contrat');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('travail').setLabel('Travail / besoin').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Transport de blé, labour, récolte...').setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('champ').setLabel('Numéro du champ (optionnel)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 12').setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('surface').setLabel('Surface (optionnel)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 4,5 ha').setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('details').setLabel('Informations (optionnel)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Ex: Utiliser le matériel dans le hangar nord...').setRequired(false)
    ),
  );

  await interaction.showModal(modal);
}

// ── Sessions de contrat (persistées : survivent aux redémarrages) ───────────
const contratSession = new Map();

function loadSessions() {
  try {
    const obj = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
    for (const [k, v] of Object.entries(obj)) contratSession.set(k, v);
    console.log('📋 ' + contratSession.size + ' session(s) de contrat rechargée(s)');
  } catch {}
}

function saveSessions() {
  try {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    fs.writeFileSync(SESSION_PATH, JSON.stringify(Object.fromEntries(contratSession), null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ contrat — sauvegarde sessions :', err.message);
  }
}

function setSession(key, data) { contratSession.set(key, data); saveSessions(); }
function delSession(key)       { contratSession.delete(key); saveSessions(); }

loadSessions();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contrat')
    .setDescription('Créer un contrat de travail pour ton exploitation'),

  async execute(interaction) {
    await startContratFlow(interaction);
  },

  startContratFlow,
  contratSession,
};

// ── Handler modal contrat → publication ──────────────────────────────────────
async function handleContratModal(interaction) {
  const userId  = interaction.customId.replace('contrat_modal_', '');
  const exploit = exp.getByOwner(userId);
  if (!exploit) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }

  const travail = interaction.fields.getTextInputValue('travail').trim();
  const champ   = interaction.fields.getTextInputValue('champ').trim();
  const surface = interaction.fields.getTextInputValue('surface').trim();
  const details = interaction.fields.getTextInputValue('details').trim();

  const channel = interaction.guild.channels.cache.get(CONTRAT_CHANNEL)
    || await interaction.guild.channels.fetch(CONTRAT_CHANNEL).catch(() => null);
  if (!channel) {
    await interaction.reply({ content: '❌ Salon des contrats introuvable (ID `' + CONTRAT_CHANNEL + '`).', flags: 64 });
    autoClean(interaction);
    return;
  }

  const data = {
    kind: 'contrat',
    exploit, travail, champ, surface, details,
    ownerId: userId, status: 'disponible',
  };

  const msg = await channel.send(disponibleMessage(data));
  data.messageId = msg.id;
  setSession('msg_' + msg.id, data);

  await agrilog(interaction.guild, '🆕 **' + exploit.nom + '** a publié un contrat — ' + travail);

  await interaction.reply({
    embeds: [{ description: '✅ Contrat publié dans <#' + CONTRAT_CHANNEL + '> !', color: 0x2ECC71 }],
    flags: 64,
  });
  autoClean(interaction);
}

const isBesoin = data => data.kind === 'besoin';
const LABEL    = data => (isBesoin(data) ? 'BESOIN' : 'CONTRAT');

// Champs décrivant l'objet (contrat = travail + champ/surface optionnels, besoin = matière/quantité)
function objetFields(data) {
  if (isBesoin(data)) {
    return [
      { name: '📦 Matière',  value: data.type,                        inline: true },
      { name: '⚖️ Quantité', value: data.quantite || '*Non précisée*', inline: true },
    ];
  }
  const fields = [{ name: '🛠️ Travail', value: data.travail, inline: true }];
  if (data.champ)   fields.push({ name: '🔢 Champ',   value: 'N° ' + data.champ, inline: true });
  if (data.surface) fields.push({ name: '📐 Surface', value: data.surface,       inline: true });
  return fields;
}

// ── Rendu du message « DISPONIBLE » (aussi réutilisé après un refus) ─────────
function disponibleMessage(data) {
  const fields = objetFields(data);
  if (!isBesoin(data)) fields.push({ name: '📝 Informations', value: data.details || '*Aucune précision*', inline: false });

  return {
    embeds: [{
      title: isBesoin(data) ? '📦 BESOIN' : '📋 CONTRAT DISPONIBLE',
      description: '🌾 **' + data.exploit.nom + '** · <@' + data.ownerId + '>',
      fields,
      color: 0x2ECC71,
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('contrat_accepter_' + data.ownerId)
        .setLabel(isBesoin(data) ? '✅ Répondre au besoin' : '✅ Accepter le contrat').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('contrat_supprimer_' + data.ownerId).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
    )],
  };
}

// ── Rendu du message « RÉSERVÉ » (grisé, bouton désactivé) ──────────────────
function reserveMessage(data) {
  return {
    embeds: [{
      title: isBesoin(data) ? '🔒 BESOIN RÉSERVÉ' : '🔒 CONTRAT RÉSERVÉ',
      description: '🌾 **' + data.exploit.nom + '** · <@' + data.ownerId + '>\n'
        + 'En négociation avec **' + data.accepteurExploit.nom + '** · <@' + data.accepteurId + '>',
      fields: objetFields(data),
      color: 0x95A5A6,
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('contrat_reserve_lock')
        .setLabel(isBesoin(data) ? '🔒 Besoin réservé' : '🔒 Contrat réservé').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('contrat_supprimer_' + data.ownerId).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
    )],
  };
}

function canDecide(interaction, data) {
  return interaction.user.id === data.ownerId
    || interaction.user.id === data.accepteurId
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

// ── Handler « Accepter le contrat » → salon privé de négociation ─────────────
async function handleContratAccepter(interaction) {
  const data = contratSession.get('msg_' + interaction.message.id);
  if (!data) { await interaction.reply({ content: '❌ Données du contrat introuvables (le bot a peut-être redémarré).', flags: 64 }); autoClean(interaction); return; }
  if (data.status === 'nego') { await interaction.reply({ content: '❌ Ce contrat est déjà en cours de négociation.', flags: 64 }); autoClean(interaction); return; }
  if (interaction.user.id === data.ownerId) { await interaction.reply({ content: '❌ Tu ne peux pas accepter ton propre contrat.', flags: 64 }); autoClean(interaction); return; }

  const accepteurExploit = exp.getByOwner(interaction.user.id);
  if (!accepteurExploit) { await interaction.reply({ content: '❌ Tu dois avoir une exploitation enregistrée pour accepter un contrat.', flags: 64 }); autoClean(interaction); return; }

  data.status          = 'nego';
  data.accepteurId     = interaction.user.id;
  data.accepteurExploit = accepteurExploit;
  data.contratChannelId = interaction.message.channelId;
  data.contratMessageId = interaction.message.id;

  // 1) Griser le contrat public
  await interaction.update(reserveMessage(data));

  // 2) Créer le salon privé de négociation
  const parentId = interaction.message.channel?.parentId || null;
  const overwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: data.ownerId,        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: data.accepteurId,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  const adminRole = interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed);
  if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const slug = accepteurExploit.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'nego';
  let negoChannel;
  try {
    negoChannel = await interaction.guild.channels.create({
      name: (isBesoin(data) ? 'besoin-' : 'contrat-') + slug,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: overwrites,
      reason: 'Négociation EURO-AGRI',
    });
  } catch (err) {
    await interaction.followUp({ content: '⚠️ Impossible de créer le salon privé (permission `Gérer les salons` manquante ?). ' + err.message, flags: 64 });
    return;
  }

  data.negoChannelId = negoChannel.id;
  setSession('msg_' + data.messageId, data);

  await agrilog(interaction.guild, (isBesoin(data) ? '📦' : '📋') + ' **' + accepteurExploit.nom + '** prend le '
    + (isBesoin(data) ? 'besoin' : 'contrat') + ' de **' + data.exploit.nom + '** — ' + objetShort(data));

  const mId  = data.messageId;
  const verb = isBesoin(data) ? 'a répondu au besoin de' : 'a accepté le contrat de';
  const negoFields = objetFields(data);
  if (!isBesoin(data)) negoFields.push({ name: '📝 Informations', value: data.details || '*Aucune précision*', inline: false });

  await negoChannel.send({
    content: '<@' + data.ownerId + '> <@' + data.accepteurId + '>',
    embeds: [{
      title: '🤝 ' + LABEL(data) + ' ACCEPTÉ — négociation',
      description: [
        '**<@' + data.accepteurId + '>** (*' + accepteurExploit.nom + '*) ' + verb + ' **' + data.exploit.nom + '**.',
        '',
        'Discutez ici du prix, du matériel et des délais.',
        '',
        'Une fois d\'accord, choisissez une option ci-dessous :',
        '> ✅ **Accepté** — l\'accord est confirmé, le salon reste ouvert',
        '> ❌ **Refusé** — ce salon est supprimé et l\'annonce redevient disponible',
        '> 🏁 **Terminé** — l\'annonce et ce salon sont supprimés',
      ].join('\n'),
      fields: negoFields,
      color: 0xF39C12,
      footer: { text: 'EURO-AGRI — Salon de négociation' },
      timestamp: new Date().toISOString(),
    }],
    components: [dealRow(mId, false)],
  });

  await interaction.followUp({ content: '✅ Salon de négociation créé : <#' + negoChannel.id + '>', flags: 64 });
}

// Ligne des 3 boutons de décision (okDisabled = accord déjà confirmé)
function dealRow(mId, okDisabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('contrat_deal_ok_' + mId)
      .setLabel(okDisabled ? '✅ Accord confirmé' : '✅ Accepté').setStyle(ButtonStyle.Success).setDisabled(!!okDisabled),
    new ButtonBuilder().setCustomId('contrat_deal_refuse_' + mId).setLabel('❌ Refusé').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('contrat_deal_done_' + mId).setLabel('🏁 Terminé').setStyle(ButtonStyle.Primary),
  );
}

// ── « Accepté » dans le salon privé → l'accord est confirmé ─────────────────
async function handleContratDealOk(interaction) {
  const mId  = interaction.customId.replace('contrat_deal_ok_', '');
  const data = contratSession.get('msg_' + mId);
  if (!data) { await interaction.reply({ content: '❌ Données introuvables.', flags: 64 }); autoClean(interaction); return; }
  if (!canDecide(interaction, data)) { await interaction.reply({ content: '❌ Seuls les deux exploitants concernés peuvent décider.', flags: 64 }); autoClean(interaction); return; }

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const embed = interaction.message.embeds[0];

  await interaction.update({
    embeds: [{
      ...embed.data,
      title: '✅ ACCORD CONFIRMÉ',
      color: 0x2ECC71,
      footer: { text: 'Accord confirmé le ' + now + ' — EURO-AGRI' },
    }],
    components: [dealRow(mId, true)],
  });

  data.status = 'confirme';
  setSession('msg_' + mId, data);

  await agrilog(interaction.guild, '🤝 Accord confirmé : **' + data.exploit.nom + '** × **' + data.accepteurExploit.nom + '** — ' + objetShort(data));
}

// Ferme le salon de négociation même si la session est perdue (bot redémarré)
async function ackSansData(interaction, titre) {
  await interaction.update({
    embeds: [{ title: titre, description: 'La session a été perdue (le bot a redémarré). Ce salon sera supprimé dans 10 secondes.', color: 0x95A5A6 }],
    components: [],
  }).catch(() => {});
  setTimeout(() => interaction.channel?.delete().catch(() => {}), 10000);
}

// ── « Contrat refusé » → salon supprimé + contrat redevient disponible ──────
async function handleContratDealRefuse(interaction) {
  const mId  = interaction.customId.replace('contrat_deal_refuse_', '');
  const data = contratSession.get('msg_' + mId);
  if (!data)                          { await ackSansData(interaction, '❌ NÉGOCIATION REFUSÉE'); return; }
  if (!canDecide(interaction, data)) { await interaction.reply({ content: '❌ Seuls les deux exploitants concernés peuvent décider.', flags: 64 }); autoClean(interaction); return; }

  // 1) Acquitter le clic tout de suite (avant tout appel réseau lent)
  await interaction.update({
    embeds: [{ title: '❌ ' + LABEL(data) + ' REFUSÉ', description: 'L\'annonce redevient disponible. Ce salon sera supprimé dans quelques secondes.', color: 0xE74C3C }],
    components: [],
  });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 8000);

  // 2) Remettre le contrat public en disponible
  const accepteurNom = data.accepteurExploit?.nom || '?';
  try {
    const ch = interaction.guild.channels.cache.get(data.contratChannelId)
      || await interaction.guild.channels.fetch(data.contratChannelId).catch(() => null);
    const contratMsg = ch && await ch.messages.fetch(data.contratMessageId).catch(() => null);
    if (contratMsg) await contratMsg.edit(disponibleMessage(data));
  } catch {}

  data.status = 'disponible';
  delete data.accepteurId;
  delete data.accepteurExploit;
  delete data.negoChannelId;
  setSession('msg_' + mId, data);

  await agrilog(interaction.guild, '❌ ' + (isBesoin(data) ? 'Besoin' : 'Contrat') + ' refusé : **' + data.exploit.nom + '** × **' + accepteurNom + '** — annonce remise en disponible');
}

// ── « Contrat terminé » → contrat public + salon privé supprimés ────────────
async function handleContratDealDone(interaction) {
  const mId  = interaction.customId.replace('contrat_deal_done_', '');
  const data = contratSession.get('msg_' + mId);
  if (!data)                          { await ackSansData(interaction, '🏁 NÉGOCIATION TERMINÉE'); return; }
  if (!canDecide(interaction, data)) { await interaction.reply({ content: '❌ Seuls les deux exploitants concernés peuvent décider.', flags: 64 }); autoClean(interaction); return; }

  // 1) Acquitter le clic tout de suite
  await interaction.update({
    embeds: [{ title: '🏁 ' + LABEL(data) + ' TERMINÉ', description: 'L\'annonce a été retirée. Ce salon sera supprimé dans 10 secondes.', color: 0x2ECC71 }],
    components: [],
  });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);

  // 2) Supprimer le contrat public
  try {
    const ch = interaction.guild.channels.cache.get(data.contratChannelId)
      || await interaction.guild.channels.fetch(data.contratChannelId).catch(() => null);
    const contratMsg = ch && await ch.messages.fetch(data.contratMessageId).catch(() => null);
    if (contratMsg) await contratMsg.delete().catch(() => {});
  } catch {}

  delSession('msg_' + mId);

  await agrilog(interaction.guild, '🏁 ' + (isBesoin(data) ? 'Besoin effectué' : 'Contrat terminé')
    + ' : **' + data.exploit.nom + '** (client) × **' + (data.accepteurExploit?.nom || '?') + '** (prestataire) — ' + objetShort(data));
}

// ── Handler supprimer contrat (par le propriétaire) ─────────────────────────
async function handleContratSupprimer(interaction) {
  const ownerId = interaction.customId.replace('contrat_supprimer_', '');
  if (interaction.user.id !== ownerId && !interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '❌ Seul le créateur du contrat peut le supprimer.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const data = contratSession.get('msg_' + interaction.message.id);
  if (data?.negoChannelId) {
    const negoCh = interaction.guild.channels.cache.get(data.negoChannelId)
      || await interaction.guild.channels.fetch(data.negoChannelId).catch(() => null);
    if (negoCh) await negoCh.delete().catch(() => {});
  }
  delSession('msg_' + interaction.message.id);

  await interaction.message.delete().catch(() => {});
  await interaction.reply({ embeds: [{ description: '🗑️ Annonce supprimée.', color: 0x95A5A6 }], flags: 64 });
  autoClean(interaction);

  if (data) {
    await agrilog(interaction.guild, '🗑️ **' + data.exploit.nom + '** a retiré son ' + (isBesoin(data) ? 'besoin' : 'contrat') + ' — ' + objetShort(data));
  }
}

// ═══ BESOIN : l'exploitant recherche une matière première ═══════════════════
async function handleBesoinButton(interaction) {
  const exploit = exp.getByOwner(interaction.user.id);
  if (!exploit) {
    await interaction.reply({ embeds: [{ description: '❌ Tu n\'as pas d\'exploitation. Crée-la depuis le **HUB des exploitants**.', color: 0xE74C3C }], flags: 64 });
    autoClean(interaction);
    return;
  }

  const modal = new ModalBuilder().setCustomId('besoin_modal_' + interaction.user.id).setTitle('Nouveau besoin');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('type').setLabel('Matière première recherchée').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Blé, Lisier, Bois, Bottes de foin...').setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('quantite').setLabel('Quantité (optionnel)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 5000 L, 20 t, 30 bottes...').setRequired(false)
    ),
  );
  await interaction.showModal(modal);
}

async function handleBesoinModal(interaction) {
  const userId  = interaction.customId.replace('besoin_modal_', '');
  const exploit = exp.getByOwner(userId);
  if (!exploit) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }

  const type     = interaction.fields.getTextInputValue('type').trim();
  const quantite = interaction.fields.getTextInputValue('quantite').trim();

  const channel = interaction.guild.channels.cache.get(CONTRAT_CHANNEL)
    || await interaction.guild.channels.fetch(CONTRAT_CHANNEL).catch(() => null);
  if (!channel) {
    await interaction.reply({ content: '❌ Salon introuvable (ID `' + CONTRAT_CHANNEL + '`).', flags: 64 });
    autoClean(interaction);
    return;
  }

  const data = { kind: 'besoin', exploit, type, quantite, ownerId: userId, status: 'disponible' };
  const msg  = await channel.send(disponibleMessage(data));
  data.messageId = msg.id;
  setSession('msg_' + msg.id, data);

  await agrilog(interaction.guild, '🆕 **' + exploit.nom + '** recherche : ' + objetShort(data));

  await interaction.reply({ embeds: [{ description: '✅ Besoin publié dans <#' + CONTRAT_CHANNEL + '> !', color: 0x2ECC71 }], flags: 64 });
  autoClean(interaction);
}

module.exports.handleContratModal       = handleContratModal;
module.exports.handleContratAccepter    = handleContratAccepter;
module.exports.handleContratDealOk      = handleContratDealOk;
module.exports.handleContratDealRefuse  = handleContratDealRefuse;
module.exports.handleContratDealDone    = handleContratDealDone;
module.exports.handleContratSupprimer   = handleContratSupprimer;
module.exports.handleBesoinButton       = handleBesoinButton;
module.exports.handleBesoinModal        = handleBesoinModal;
