const fs = require('fs');
const { noter } = require('./panneau-sync');
const ids = require('./ids');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const exp = require('./exploitation');
const { agrilog } = require('./agrilog');
const { panneau } = require('./embed-format');

// ── Config ────────────────────────────────────────────────────────────────────
const HUB_CHANNEL        = ids('HUB_CHANNEL_ID'); // salon du hub
const EXPLOITANT_ROLE_ID = ids('EXPLOITANT_ROLE_ID');

const ACTIVITES = [
  { label: '🌾 Céréales & Grandes cultures', value: 'Céréales & Grandes cultures' },
  { label: '🥕 Maraîchage',                  value: 'Maraîchage' },
  { label: '🌱 Cultures spécialisées',        value: 'Cultures spécialisées' },
  { label: '🍇 Viticulture',                  value: 'Viticulture' },
  { label: '🌲 Sylviculture',                 value: 'Sylviculture' },
  { label: '🌿 Fauchage / Ensilage',          value: 'Fauchage / Ensilage' },
  { label: '🐄 Élevage Bovin',               value: 'Élevage Bovin' },
  { label: '🐷 Élevage Porcin',              value: 'Élevage Porcin' },
  { label: '🐑 Élevage Ovin',               value: 'Élevage Ovin' },
  { label: '🐐 Élevage Caprin',             value: 'Élevage Caprin' },
  { label: '🐔 Élevage Avicole',            value: 'Élevage Avicole' },
  { label: '🐴 Élevage Équin',              value: 'Élevage Équin' },
  { label: '🐃 Élevage Bubalin',            value: 'Élevage Bubalin' },
  { label: '🚜 Travaux agricoles',           value: 'Travaux agricoles' },
  { label: '🤝 Sous-traitance',              value: 'Sous-traitance' },
  { label: '⚡ Biogaz',                       value: 'Biogaz' },
];

// Couleurs d'embed proposées à l'exploitant (menu déroulant, pas de saisie libre).
const PRESET_COLORS = [
  { label: '🔵 Bleu',        value: 0x5865F2 },
  { label: '🟢 Vert',        value: 0x2ECC71 },
  { label: '🌲 Vert sombre', value: 0x1F8B4C },
  { label: '🩵 Turquoise',   value: 0x1ABC9C },
  { label: '💧 Cyan',        value: 0x3498DB },
  { label: '🟣 Violet',      value: 0x9B59B6 },
  { label: '🌸 Rose',        value: 0xE91E63 },
  { label: '🔴 Rouge',       value: 0xE74C3C },
  { label: '🟠 Orange',      value: 0xE67E22 },
  { label: '🟡 Or',          value: 0xF1C40F },
  { label: '🟤 Terre',       value: 0xA84300 },
  { label: '⚪ Gris',        value: 0x95A5A6 },
];
const DEFAULT_COLOR = 0x2ECC71;

// Toutes les exploitations qu'un joueur gère (créateur ou co-exploitant),
// exploitation possédée en premier. Sert au menu « Mon exploitation ».
function managedExploitations(uid) {
  const all = exp.getAll();
  const seen = new Set();
  return [
    ...all.filter(e => e.ownerId === uid),
    ...all.filter(e => (e.coExploitants || []).includes(uid)),
  ].filter(e => !seen.has(e.id) && seen.add(e.id));
}

// ── Utilitaire : supprimer un message éphémère une fois l'action terminée ─────
function autoClean(interaction, delay = 4000) {
  setTimeout(() => { interaction.deleteReply().catch(() => {}); }, delay);
}

// ── Message HUB (publié au démarrage) ───────────────────────────────────────
const HUB_MSG_FILE = require('./paths').dataPath('hub-messages.json');
async function postHub(channel) {
  const saved = (() => { try { return JSON.parse(fs.readFileSync(HUB_MSG_FILE, 'utf-8')); } catch { return {}; } })();
  // Statut FS25 en direct : message du pont, placé EN PREMIER dans le salon s'il est configuré ici.
  const bridge = require('./fs25-bridge');
  const status = bridge.isStatusChannel(channel) ? await bridge.ensureStatusMessage(channel).catch(() => null) : null;
  const nettoyer = async () => {
    try {
      const msgs = await channel.messages.fetch({ limit: 100 });
      for (const [, m] of msgs) {
        if (m.author.id === channel.client.user.id && m.id !== status?.id) await m.delete().catch(() => {});
      }
    } catch {}
  };
  // Mise à jour en place si les messages existent encore ET dans le bon ordre (statut, infos, HUB) ; sinon on nettoie et on republie
  const [i0, p0] = await Promise.all([saved.info, saved.main].map(id => id && channel.messages.fetch(id).catch(() => null)));
  const enPlace = !!(i0 && p0 && (!status || BigInt(status.id) < BigInt(i0.id)));
  if (!enPlace) await nettoyer();
  const info = require('./hub-info').buildMessage();
  const payload = panneauHub();
  const i = enPlace ? i0 : await channel.send(info);
  const p = enPlace ? p0 : await channel.send(payload);
  if (enPlace) { await i.edit(info); await p.edit(payload); }
  noter(channel, 'HUB des exploitants', enPlace ? 'modifié' : 'republié');
  try { fs.writeFileSync(HUB_MSG_FILE, JSON.stringify({ info: i.id, main: p.id })); } catch {}
}

function panneauHub() {
  return panneau({
    embeds: [{
      title: '🌾  LE COIN DES COPAINS  ·  HUB DES EXPLOITANTS',
      description: 'Exploitation, contrats, échanges : tout se fait avec les boutons.',
      color: 0x2ECC71,
      footer: { text: 'MonCopainBot' },
    }],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hub_expl').setLabel('🌾 Mon exploitation').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hub_contrat').setLabel('📋 Créer un contrat').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hub_besoin').setLabel('📦 Besoin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hub_annuaire').setLabel('📖 Annuaire · ON').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hub_boutique').setLabel('🛒 Boutique').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hub_marche').setLabel('🏪 Marché').setStyle(ButtonStyle.Success),
      ),
    ],
  });
}

// ═══ BOUTON « Mon exploitation » ════════════════════════════════════════════
async function handleHubExpl(interaction) {
  const uid  = interaction.user.id;
  const list = managedExploitations(uid);

  if (!list.length) {
    await interaction.reply({
      embeds: [{ title: '🌾 Créer mon exploitation', description: 'Tu n\'as pas encore d\'exploitation. Clique ci-dessous pour en créer une !', color: 0x5865F2 }],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hub_expl_creer').setLabel('🌾 Créer mon exploitation').setStyle(ButtonStyle.Success),
      )],
      flags: 64,
    });
    autoClean(interaction, 120000);
    return;
  }

  // Une carte distincte (couleur, menu) par exploitation gérée
  await interaction.reply({ ...manageMenu(list[0], uid, { i: 1, n: list.length }), flags: 64 });
  autoClean(interaction, 120000);
  for (const [k, e] of list.slice(1).entries()) {
    const m = await interaction.followUp({ ...manageMenu(e, uid, { i: k + 2, n: list.length }), flags: 64 });
    setTimeout(() => interaction.webhook.deleteMessage(m.id).catch(() => {}), 120000);
  }
}

// Menu de gestion (réutilisé par le hub et par la carte). Renvoie un payload sans `flags`.
// viewerId : qui consulte (pour n'afficher la gestion du co-exploitant qu'au créateur).
// pos      : { i, n } rang de l'exploitation quand le viewer en gère plusieurs.
function manageMenu(exploit, viewerId, pos) {
  const hasOuvriers = exploit.ouvriers?.length > 0;
  const hasCo       = (exploit.coExploitants?.length || 0) > 0;
  const isOwner     = viewerId === exploit.ownerId;

  const options = [
    { label: '📝 Renommer l\'exploitation', value: 'nom' },
    { label: '🥇 Activité principale',       value: 'principale' },
    { label: '🥈 Activité secondaire',       value: 'secondaire' },
    hasOuvriers
      ? { label: '🥉 Activité supplémentaire', value: 'supplementaire' }
      : { label: '🥉 Activité supplémentaire', value: 'supplementaire', description: '🔒 Nécessite un ouvrier' },
    { label: '🧑‍🌾 Recrutement (oui / non)', value: 'recrute' },
    { label: '🎨 Couleur de l\'exploitation', value: 'couleur' },
    { label: '➕ Ajouter un ouvrier',        value: 'ouvrier_add' },
  ];
  if (hasOuvriers) options.push({ label: '➖ Retirer un ouvrier', value: 'ouvrier_del' });
  if (isOwner && !hasCo) options.push({ label: '🤝 Ajouter un co-exploitant', value: 'coexpl_add' });
  if (isOwner && hasCo)  options.push({ label: '➖ Retirer le co-exploitant', value: 'coexpl_del' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_manage_' + exploit.ownerId)
    .setPlaceholder('Que veux-tu faire ?')
    .addOptions(options);

  const components = [new ActionRowBuilder().addComponents(menu)];
  const dateCrea = exploit.createdAt ? new Date(exploit.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  return panneau({
    embeds: [{
      title: '🌾  ' + exploit.nom.toUpperCase(),
      description: [
        '👑 **Exploitant :** <@' + exploit.ownerId + '>' + (dateCrea ? '　│　📅 **Créée le** ' + dateCrea : ''),
        '🧑‍🌾 **Recrutement :** ' + (exploit.recrute ? '🟢 Ouvert' : '🔴 Fermé'),
      ].join('\n'),
      fields: [
        {
          name: '🚜  Activités',
          value: [
            '🥇 **Principale :** ' + (exploit.activitePrincipale || '*Non définie*'),
            '🥈 **Secondaire :** ' + (exploit.activiteSecondaire || '*Non définie*'),
            '🥉 **Supplémentaire :** ' + (hasOuvriers ? (exploit.activiteSupplementaire || '*Non définie*') : '🔒 *Nécessite un ouvrier*'),
          ].join('\n'),
          inline: false,
        },
        { name: '🤝  Co-exploitant', value: hasCo ? exploit.coExploitants.map(id => '<@' + id + '>').join(', ') : '*Aucun*', inline: true },
        { name: '👷  Ouvriers (' + (exploit.ouvriers?.length || 0) + ')', value: hasOuvriers ? exploit.ouvriers.map(id => '<@' + id + '>').join(', ') : '*Aucun*', inline: true },
      ],
      color: exploit.couleur ?? DEFAULT_COLOR,
      footer: { text: 'MonCopainBot' + (pos?.n > 1 ? ' · Exploitation ' + pos.i + '/' + pos.n : '') },
    }],
    components,
  });
}

// ── Bouton « Créer mon exploitation » → modale ──────────────────────────────
async function handleHubExplCreer(interaction) {
  const modal = new ModalBuilder().setCustomId('hub_expl_creer_modal').setTitle('Créer mon exploitation');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('nom').setLabel('Nom de ton exploitation').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Ferme des Collines').setRequired(true),
  ));
  await interaction.showModal(modal);
}

// ── Modale création ─────────────────────────────────────────────────────────
async function handleHubExplCreerModal(interaction) {
  const nom = interaction.fields.getTextInputValue('nom').trim();

  if (exp.getByOwner(interaction.user.id)) {
    await interaction.reply({ content: '❌ Tu as déjà une exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if (exp.getByName(nom)) {
    await interaction.reply({ content: '❌ Ce nom est déjà pris.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const exploitation = exp.createExploitation(interaction.user.id, interaction.user.tag, nom);
  await interaction.member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});

  await agrilog(interaction.guild, '🌾 Nouvelle exploitation : **' + nom + '** par <@' + interaction.user.id + '>');

  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_setact_' + exploitation.id + '_principale_setup')
    .setPlaceholder('Choisis ton activité principale...')
    .addOptions(ACTIVITES);

  await interaction.reply({
    embeds: [{ title: '🌾 ' + nom + ' créée !', description: '✅ Rôle **Exploitant** attribué.\n\nChoisis ton **activité principale** :', color: 0x2ECC71 }],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64,
  });
  autoClean(interaction, 120000);
}

// ── Select du menu de gestion ───────────────────────────────────────────────
async function handleHubExplManage(interaction) {
  const ownerId = interaction.customId.replace('hub_expl_manage_', '');
  const exploit = exp.getByOwner(ownerId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  if (!canManage(interaction, exploit)) {
    await interaction.reply({ content: '❌ Seul un exploitant (ou un admin) peut gérer cette exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const choice = interaction.values[0];

  // Gestion du co-exploitant : réservée au créateur (pas aux co-exploitants).
  if ((choice === 'coexpl_add' || choice === 'coexpl_del') && interaction.user.id !== exploit.ownerId) {
    await interaction.reply({ content: '❌ Seul le créateur de l\'exploitation peut gérer le co-exploitant.', flags: 64 });
    autoClean(interaction);
    return;
  }

  if (choice === 'supplementaire' && !(exploit.ouvriers?.length > 0)) {
    await interaction.reply({ content: '❌ Il faut au moins un ouvrier pour débloquer l\'activité supplémentaire.', flags: 64 });
    autoClean(interaction);
    return;
  }

  if (choice === 'nom') {
    const modal = new ModalBuilder().setCustomId('hub_expl_nom_' + exploit.id).setTitle('Renommer l\'exploitation');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setValue(exploit.nom).setRequired(true),
    ));
    await interaction.showModal(modal);
    return;
  }

  if (choice === 'recrute') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('hub_expl_recrute_' + exploit.id)
      .setPlaceholder('Tu recrutes ?')
      .addOptions([
        { label: '✅ Oui, je recrute', value: 'oui' },
        { label: '❌ Non', value: 'non' },
      ]);
    await interaction.update({
      embeds: [{ title: '🧑‍🌾 Recrutement · ' + exploit.nom, description: 'Est-ce que ton exploitation recrute ?', color: 0x5865F2 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'couleur') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('hub_expl_couleur_' + exploit.id)
      .setPlaceholder('Choisis une couleur...')
      .addOptions(PRESET_COLORS.map(c => ({ label: c.label, value: String(c.value) })));
    await interaction.update({
      embeds: [{ title: '🎨 Couleur · ' + exploit.nom, description: 'Choisis la couleur des embeds de ton exploitation (fiche, annuaire, annonces).', color: exploit.couleur ?? DEFAULT_COLOR }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'coexpl_add') {
    const menu = new UserSelectMenuBuilder()
      .setCustomId('hub_expl_coadd_' + exploit.id)
      .setPlaceholder('Choisis le 2ᵉ exploitant...')
      .setMaxValues(1);
    await interaction.update({
      embeds: [{ title: '🤝 Ajouter un co-exploitant · ' + exploit.nom,
        description: 'Le co-exploitant aura **les mêmes droits que toi** : contrats, besoins, fiche, ouvriers, couleur.\nIl **ne pourra pas** te retirer, supprimer l\'exploitation, ni ajouter/retirer un autre co-exploitant.', color: 0x2ECC71 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'coexpl_del') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('hub_expl_codel_' + exploit.id)
      .setPlaceholder('Retirer le co-exploitant...')
      .addOptions(exploit.coExploitants.map((id, i) => ({ label: exploit.coExploitantTags[i] || id, value: id })));
    await interaction.update({
      embeds: [{ title: '➖ Retirer le co-exploitant · ' + exploit.nom, color: 0xE74C3C }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'ouvrier_add') {
    const menu = new UserSelectMenuBuilder()
      .setCustomId('hub_expl_ouvadd_' + exploit.id)
      .setPlaceholder('Tague le joueur à ajouter comme ouvrier...')
      .setMaxValues(1);
    await interaction.update({
      embeds: [{ title: '➕ Ajouter un ouvrier · ' + exploit.nom, description: 'Sélectionne le joueur (tu peux le chercher avec @).', color: 0x2ECC71 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'ouvrier_del') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('hub_expl_ouvdel_' + exploit.id)
      .setPlaceholder('Choisis l\'ouvrier à retirer...')
      .addOptions(exploit.ouvriers.map((id, i) => ({ label: exploit.ouvrierTags[i] || id, value: id })));
    await interaction.update({
      embeds: [{ title: '➖ Retirer un ouvrier · ' + exploit.nom, color: 0xE74C3C }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  // principale / secondaire / supplementaire
  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_setact_' + exploit.id + '_' + choice + '_edit')
    .setPlaceholder('Choisis une activité...')
    .addOptions(ACTIVITES);
  await interaction.update({
    embeds: [{ title: '✏️ ' + exploit.nom, description: 'Choisis la nouvelle activité :', color: 0x5865F2 }],
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

// ── Select d'une activité (création ou modification) ────────────────────────
async function handleHubExplSetAct(interaction) {
  const rest  = interaction.customId.replace('hub_expl_setact_', '');
  const parts = rest.split('_');
  const mode  = parts.pop();               // 'setup' | 'edit'
  const field = parts.pop();               // 'principale' | 'secondaire' | 'supplementaire'
  const exploitId = parts.join('_');       // 'exploit_<id>'

  const dbField = field === 'principale' ? 'activitePrincipale'
    : field === 'secondaire' ? 'activiteSecondaire' : 'activiteSupplementaire';
  exp.updateExploitation(exploitId, { [dbField]: interaction.values[0] });

  const exploit = Object.values(exp.load()).find(e => e.id === exploitId);

  if (mode === 'setup' && field === 'principale') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('hub_expl_setact_' + exploitId + '_secondaire_setup')
      .setPlaceholder('Choisis ton activité secondaire...')
      .addOptions(ACTIVITES);
    await interaction.update({
      embeds: [{ title: '✅ Activité principale enregistrée', description: 'Choisis ton **activité secondaire** :', color: 0x2ECC71 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  await interaction.update({
    embeds: [{ description: mode === 'setup'
      ? '🎉 Exploitation configurée ! Utilise **📖 Annuaire** pour voir toutes les exploitations.'
      : '✅ Activité mise à jour.', color: 0x2ECC71 }],
    components: [],
  });
  autoClean(interaction);
}

// ── Modale renommage ────────────────────────────────────────────────────────
async function handleHubExplNom(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_nom_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }

  const nom = interaction.fields.getTextInputValue('nom').trim();
  if (exp.getByName(nom) && nom.toLowerCase() !== exploit.nom.toLowerCase()) {
    await interaction.reply({ content: '❌ Ce nom est déjà pris.', flags: 64 });
    autoClean(interaction);
    return;
  }

  exp.updateExploitation(exploitId, { nom });
  await interaction.reply({ content: '✅ Exploitation renommée en **' + nom + '**.', flags: 64 });
  autoClean(interaction);
}

// ── Sélection utilisateur → ajout ouvrier ──────────────────────────────────
async function handleHubExplOuvAdd(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_ouvadd_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const id     = interaction.values[0];
  const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
  if (!member) {
    await interaction.update({ embeds: [{ description: '❌ Joueur introuvable sur le serveur.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }
  if (member.user.bot) {
    await interaction.update({ embeds: [{ description: '❌ Impossible d\'ajouter un bot.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }
  if (exploit.ouvriers?.includes(id)) {
    await interaction.update({ embeds: [{ description: '❌ **' + member.user.username + '** est déjà ouvrier.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }

  exp.addOuvrier(exploit.id, id, member.user.tag);
  await interaction.update({ embeds: [{ description: '✅ **' + member.user.username + '** ajouté comme ouvrier à **' + exploit.nom + '**.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
}

// ── Select Oui/Non recrutement ─────────────────────────────────────────────
async function handleHubExplRecrute(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_recrute_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const recrute = interaction.values[0] === 'oui';
  exp.updateExploitation(exploitId, { recrute });
  await interaction.update({
    embeds: [{ description: recrute ? '✅ Recrutement **ouvert**.' : '✅ Recrutement **fermé**.', color: 0x2ECC71 }],
    components: [],
  });
  autoClean(interaction);
}

// ── Select retrait ouvrier ──────────────────────────────────────────────────
async function handleHubExplOuvDel(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_ouvdel_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  exp.removeOuvrier(exploit.id, interaction.values[0]);
  await interaction.update({ embeds: [{ description: '✅ Ouvrier retiré de **' + exploit.nom + '**.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
}

// ── Select couleur ────────────────────────────────────────────────────────
async function handleHubExplCouleur(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_couleur_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (!canManage(interaction, exploit)) {
    await interaction.reply({ content: '❌ Réservé aux exploitants.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const couleur = parseInt(interaction.values[0], 10);
  exp.updateExploitation(exploitId, { couleur });
  await interaction.update({ embeds: [{ description: '✅ Couleur de l\'exploitation mise à jour.', color: couleur }], components: [] });
  autoClean(interaction);
}

// ── Select utilisateur → ajout co-exploitant (créateur uniquement) ────────
async function handleHubExplCoAdd(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_coadd_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (interaction.user.id !== exploit.ownerId) {
    await interaction.reply({ content: '❌ Seul le créateur peut ajouter un co-exploitant.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if ((exploit.coExploitants?.length || 0) >= 1) {
    await interaction.update({ embeds: [{ description: '❌ Il y a déjà un co-exploitant. Retire-le d\'abord.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }

  const id = interaction.values[0];
  const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
  if (!member)               { await interaction.update({ embeds: [{ description: '❌ Joueur introuvable sur le serveur.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }
  if (member.user.bot)       { await interaction.update({ embeds: [{ description: '❌ Impossible d\'ajouter un bot.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }
  if (id === exploit.ownerId){ await interaction.update({ embeds: [{ description: '❌ Tu es déjà le créateur.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }

  const wasOuvrier = (exploit.ouvriers || []).includes(id);
  exp.addCoExploitant(exploit.id, id, member.user.tag);
  await member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});

  await interaction.update({ embeds: [{
    description: '✅ **' + member.user.username + '** est maintenant **co-exploitant** de **' + exploit.nom + '**'
      + (wasOuvrier ? ' *(retiré de la liste des ouvriers)*' : '') + '.\nMêmes droits que toi.',
    color: 0x2ECC71 }], components: [] });
  autoClean(interaction);

  await agrilog(interaction.guild, '🤝 **' + exploit.nom + '** : <@' + id + '> ajouté comme co-exploitant par <@' + interaction.user.id + '>');
}

// ── Select retrait co-exploitant (créateur uniquement) ────────────────────
async function handleHubExplCoDel(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_codel_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (interaction.user.id !== exploit.ownerId) {
    await interaction.reply({ content: '❌ Seul le créateur peut retirer le co-exploitant.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const coId = interaction.values[0];
  exp.removeCoExploitant(exploit.id, coId);
  await interaction.update({ embeds: [{ description: '✅ Co-exploitant retiré de **' + exploit.nom + '**. *(Le rôle Discord Exploitant est conservé.)*', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);

  await agrilog(interaction.guild, '➖ **' + exploit.nom + '** : <@' + coId + '> retiré des co-exploitants par <@' + interaction.user.id + '>');
}

function isAdmin(interaction) {
  return !!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

// Annuaire = UN SEUL embed : une rubrique (champ) par exploitation active.
// Active = au moins un de ses exploitants est encore visible (présent, ni parti, ni banni, ni inactif).
const MAX_EXPL = 20;
const TRAIT = '─'.repeat(30);

// Fiche d'une exploitation, au format de l'annuaire :
// Nom / Exploitant / Recrutement / 2ᵉ exploitant / Créée le / Activités 1-2 / Élevage 1-2 / Ouvriers.
// Les activités « Élevage … » vont dans les lignes Élevage, les autres dans les lignes Activités.
function ficheAnnuaire(e, vis) {
  const ouvriers = (e.ouvriers || []).filter(id => vis.has(id));
  const co = (e.coExploitants || []).filter(id => vis.has(id));
  const dateCrea = new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const acts = [e.activitePrincipale, e.activiteSecondaire, ouvriers.length ? e.activiteSupplementaire : null].filter(Boolean);
  const elevage = acts.filter(a => a.startsWith('Élevage'));
  const autres  = acts.filter(a => !a.startsWith('Élevage'));
  const slot = (list, i) => (i === 0 ? list[0] : list.slice(1).join(' · ')) || '—';
  return [
    '**Nom :** ' + e.nom,
    '**Exploitant :** ' + (vis.has(e.ownerId) ? '<@' + e.ownerId + '>' : '—'),
    '**RECRUTEMENT :** ' + (e.recrute ? 'OUI' : 'NON'),
    '**Exploitant :** ' + (co.length ? co.map(id => '<@' + id + '>').join(' · ') : '—'),
    '**Créée le :** ' + dateCrea,
    '**Activités 1 :** ' + slot(autres, 0),
    '**Activités 2 :** ' + slot(autres, 1),
    '**Élevage 1 :** ' + slot(elevage, 0),
    '**Élevage 2 :** ' + slot(elevage, 1),
    '**Ouvriers :** ' + (ouvriers.length ? ouvriers.map(id => '<@' + id + '>').join(', ') : 'Aucun'),
  ].join('\n');
}

function renderAnnuaire(admin) {
  const vis = require('./database').idsVisibles();
  const all = exp.getAll()
    .filter(e => e.nom && [e.ownerId, ...(e.coExploitants || [])].some(id => vis.has(id)))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  // Fiches séparées par un trait, dans une seule description (limite Discord : 4096 caractères)
  const shown = [];
  let corps = '';
  for (const e of all.slice(0, MAX_EXPL)) {
    const bloc = TRAIT + '\n' + ficheAnnuaire(e, vis) + '\n';
    if ((corps + bloc + TRAIT).length > 3700) break;
    corps += bloc;
    shown.push(e);
  }
  const recr = all.filter(e => e.recrute).length;

  const rows = [];
  if (admin) {
    const del = shown.map(e => new ButtonBuilder().setCustomId('hub_annuaire_del_' + e.id).setLabel('🗑️ ' + e.nom.slice(0, 20)).setStyle(ButtonStyle.Danger));
    for (let i = 0; i < del.length && rows.length < 4; i += 5) rows.push(new ActionRowBuilder().addComponents(del.slice(i, i + 5)));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_annuaire_off').setLabel('📖 Annuaire · OFF').setStyle(ButtonStyle.Danger),
  ));

  return {
    ...panneau({ embeds: [{
      title: '📖  ANNUAIRE DES EXPLOITATIONS',
      description: all.length
        ? '**' + all.length + '** exploitation(s) active(s)　│　**' + recr + '** en recrutement\n' + corps + TRAIT
          + (all.length > shown.length ? '\n⚠️ *' + (all.length - shown.length) + ' non affichée(s).*' : '')
        : '📭 Aucune exploitation active pour le moment.',
      color: 0x1F8B4C,
      footer: { text: 'MonCopainBot' },
    }] }),
    components: all.length ? rows : [],
    empty: !all.length,
  };
}

// ═══ BOUTON « Annuaire » (ON = affiche la liste, OFF = l'efface) ═══
async function handleHubAnnuaire(interaction) {
  const { empty, ...view } = renderAnnuaire(isAdmin(interaction));
  await interaction.reply({ ...view, flags: 64 });
  autoClean(interaction, empty ? 30000 : 15 * 60 * 1000);
}

// Bouton OFF → efface l'annuaire du joueur
async function handleHubAnnuaireOff(interaction) {
  await interaction.deferUpdate();
  await interaction.deleteReply().catch(() => {});
}

// ── Suppression admin d'une exploitation depuis l'annuaire ──────────────────
// Étape 1 : demande de confirmation.
async function handleHubAnnuaireDel(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const id = interaction.customId.replace('hub_annuaire_del_', '');
  const exploit = exp.getById(id);
  if (!exploit) {
    await interaction.reply({ content: '❌ Exploitation introuvable (déjà supprimée ?).', flags: 64 });
    autoClean(interaction);
    return;
  }

  await interaction.update({
    embeds: [{
      title: '⚠️ Confirmer la suppression',
      description: 'Supprimer définitivement **' + exploit.nom + '** (créateur <@' + exploit.ownerId + '>) ?\n'
        + 'Action **irréversible** : co-exploitants et ouvriers seront perdus.',
      color: 0xE74C3C,
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_annuaire_delyes_' + id).setLabel('🗑️ Confirmer la suppression').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('hub_annuaire_delno_' + id).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    )],
  });
}

// Étape 2a : confirmation → suppression effective puis retour à l'annuaire rafraîchi.
async function handleHubAnnuaireDelYes(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const id = interaction.customId.replace('hub_annuaire_delyes_', '');
  const exploit = exp.getById(id);
  if (exploit) {
    exp.deleteExploitation(id);
    await agrilog(interaction.guild, '🗑️ Exploitation supprimée : **' + exploit.nom + '** (créateur <@' + exploit.ownerId + '>) · par <@' + interaction.user.id + '>');
  }
  const { empty, ...view } = renderAnnuaire(true);
  await interaction.update({ ...view });
}

// Étape 2b : annulation → retour à l'annuaire sans rien supprimer.
async function handleHubAnnuaireDelNo(interaction) {
  const { empty, ...view } = renderAnnuaire(isAdmin(interaction));
  await interaction.update({ ...view });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// Peut gérer la fiche = exploitant (créateur ou co-exploitant) ou admin serveur.
function canManage(interaction, exploit) {
  return exp.isManager(exploit, interaction.user.id)
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  HUB_CHANNEL, EXPLOITANT_ROLE_ID, ACTIVITES,
  postHub: async channel => { await postHub(channel); await require('./nettoyage').epurer(channel.client, channel.id); },
  handleHubExpl, handleHubExplCreer, handleHubExplCreerModal,
  handleHubExplManage, handleHubExplSetAct, handleHubExplNom,
  handleHubExplOuvAdd, handleHubExplOuvDel, handleHubAnnuaire, handleHubAnnuaireOff,
  handleHubAnnuaireDel, handleHubAnnuaireDelYes, handleHubAnnuaireDelNo,
  handleHubExplRecrute, handleHubExplCouleur, handleHubExplCoAdd, handleHubExplCoDel,
};
