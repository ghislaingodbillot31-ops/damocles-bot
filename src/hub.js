const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const exp = require('./exploitation');
const { agrilog } = require('./agrilog');

// ── Config ────────────────────────────────────────────────────────────────────
const HUB_CHANNEL        = '1544303765602173020'; // salon du hub
const EXPLOITANT_ROLE_ID = '1544719267495157831';

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
];

// ── Utilitaire : supprimer un message éphémère une fois l'action terminée ─────
function autoClean(interaction, delay = 4000) {
  setTimeout(() => { interaction.deleteReply().catch(() => {}); }, delay);
}

// ── Message HUB (publié au démarrage) ───────────────────────────────────────
async function postHub(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 100 });
    for (const [, m] of msgs) {
      if (m.author.id === channel.client.user.id) await m.delete().catch(() => {});
    }
  } catch {}

  await channel.send({
    embeds: [{
      title: '🌾  EURO-AGRI  —  HUB DES EXPLOITANTS',
      description: [
        'Bienvenue sur le **HUB des exploitants EURO-AGRI**. Tout se gère depuis les boutons ci-dessous — ',
        'crée ton exploitation, publie tes contrats, signale tes besoins et consulte l\'annuaire du serveur.',
        '​',
        '**🌾  Mon exploitation**',
        '> Crée ton exploitation puis configure **son nom**, ses **3 activités** (principale, secondaire, supplémentaire),',
        '> **tes ouvriers** (ajout par mention `@`), l\'état de ton **recrutement** et la liste de **tes produits en vente**.',
        '> Le rôle **Exploitant** est attribué automatiquement dès la création.',
        '​',
        '**📋  Créer un contrat / sous-traitance**',
        '> Publie un contrat de travail (travail demandé, champ, surface, précisions). Un autre exploitant peut l\'accepter :',
        '> un **salon privé de négociation** s\'ouvre alors entre vous pour convenir du prix et des délais.',
        '​',
        '**📦  Besoin**',
        '> Signale que tu **recherches une matière première** (type + quantité). Fonctionne comme un contrat :',
        '> un exploitant peut y répondre et négocier avec toi en privé.',
        '​',
        '**📖  Annuaire**',
        '> Affiche la **liste complète des exploitations** du serveur (activités, ouvriers, produits, recrutement).',
        '> Visible par toi seul — un clic sur **ON** pour l\'afficher, un clic sur **OFF** pour la masquer.',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'EURO-AGRI · Damoclès Bot' },
    }],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hub_expl').setLabel('🌾 Mon exploitation').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hub_contrat').setLabel('📋 Créer un contrat').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hub_besoin').setLabel('📦 Besoin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hub_annuaire').setLabel('📖 Annuaire · ON').setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

// ═══ BOUTON « Mon exploitation » ════════════════════════════════════════════
async function handleHubExpl(interaction) {
  const exploit = exp.getByOwner(interaction.user.id);

  if (!exploit) {
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

  await interaction.reply({ ...manageMenu(exploit), flags: 64 });
  autoClean(interaction, 120000);
}

// Menu de gestion (réutilisé par le hub et par la carte). Renvoie un payload sans `flags`.
function manageMenu(exploit) {
  const hasOuvriers = exploit.ouvriers?.length > 0;
  const options = [
    { label: '📝 Renommer l\'exploitation', value: 'nom' },
    { label: '🥇 Activité principale',       value: 'principale' },
    { label: '🥈 Activité secondaire',       value: 'secondaire' },
    hasOuvriers
      ? { label: '🥉 Activité supplémentaire', value: 'supplementaire' }
      : { label: '🥉 Activité supplémentaire', value: 'supplementaire', description: '🔒 Nécessite un ouvrier' },
    { label: '🧑‍🌾 Recrutement (oui / non)', value: 'recrute' },
    { label: '🛒 Vos produits',             value: 'produits' },
    { label: '➕ Ajouter un ouvrier',        value: 'ouvrier_add' },
  ];
  if (hasOuvriers) options.push({ label: '➖ Retirer un ouvrier', value: 'ouvrier_del' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_manage_' + exploit.ownerId)
    .setPlaceholder('Que veux-tu faire ?')
    .addOptions(options);

  return {
    embeds: [{
      title: '🌾 ' + exploit.nom,
      fields: [
        { name: '🥇 Principale',     value: exploit.activitePrincipale   || '*Non définie*', inline: true },
        { name: '🥈 Secondaire',     value: exploit.activiteSecondaire    || '*Non définie*', inline: true },
        { name: '🥉 Supplémentaire', value: hasOuvriers ? (exploit.activiteSupplementaire || '*Non définie*') : '🔒 *Nécessite ouvrier*', inline: true },
        { name: '🧑‍🌾 Recrutement',  value: exploit.recrute ? '✅ Ouvert' : '❌ Fermé', inline: true },
        { name: '👷 Ouvriers',       value: hasOuvriers ? exploit.ouvriers.map(id => '<@' + id + '>').join(', ') : '*Aucun*', inline: true },
        { name: '🛒 Produits',       value: exploit.produits?.length ? exploit.produits.map(p => '• ' + p).join('\n') : '*Aucun*', inline: false },
      ],
      color: 0x2ECC71,
    }],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

// Vue de gestion des produits (ajout en boucle). Renvoie un payload sans `flags`.
function produitsView(exploit) {
  const list = exploit.produits?.length
    ? exploit.produits.map((p, i) => '`' + (i + 1) + '.` ' + p).join('\n')
    : '*Aucun produit pour le moment.*';

  const rows = [];
  if (exploit.produits?.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('hub_expl_proddel_' + exploit.id)
        .setPlaceholder('Retirer un produit...')
        .addOptions(exploit.produits.map((p, i) => ({ label: p.slice(0, 100), value: String(i) }))),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_expl_prodadd_' + exploit.id).setLabel('➕ Ajouter un produit').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('hub_expl_done_' + exploit.ownerId).setLabel('✅ Terminé').setStyle(ButtonStyle.Secondary),
  ));

  return {
    embeds: [{
      title: '🛒 Vos produits — ' + exploit.nom,
      description: list + '\n\nAjoute un produit, valide, puis recommence. Clique **✅ Terminé** quand tu as fini.',
      color: 0x2ECC71,
    }],
    components: rows,
  };
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

  if (!canManage(interaction, ownerId)) {
    await interaction.reply({ content: '❌ Seul le propriétaire (ou un admin) peut gérer cette exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const choice = interaction.values[0];

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
      embeds: [{ title: '🧑‍🌾 Recrutement — ' + exploit.nom, description: 'Est-ce que ton exploitation recrute ?', color: 0x5865F2 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  if (choice === 'produits') {
    await interaction.update(produitsView(exploit));
    return;
  }

  if (choice === 'ouvrier_add') {
    const menu = new UserSelectMenuBuilder()
      .setCustomId('hub_expl_ouvadd_' + exploit.id)
      .setPlaceholder('Tague le joueur à ajouter comme ouvrier...')
      .setMaxValues(1);
    await interaction.update({
      embeds: [{ title: '➕ Ajouter un ouvrier — ' + exploit.nom, description: 'Sélectionne le joueur (tu peux le chercher avec @).', color: 0x2ECC71 }],
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
      embeds: [{ title: '➖ Retirer un ouvrier — ' + exploit.nom, color: 0xE74C3C }],
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

// ── Bouton « Ajouter un produit » → modale ─────────────────────────────────
async function handleHubExplProdAdd(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_prodadd_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }

  const modal = new ModalBuilder().setCustomId('hub_expl_prodmodal_' + exploit.id).setTitle('Ajouter un produit / prestation');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('Produit ou prestation').setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 🌾 Balle de foin ronde  ·  📦 Mise en balle').setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('prix').setLabel('Prix').setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 0,12  ·  150').setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('unite').setLabel('Unité').setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: €/L  ·  €/U  ·  €/t  ·  €/h').setRequired(true),
    ),
  );
  await interaction.showModal(modal);
}

// ── Modale produit → ajout + retour à la vue produits ──────────────────────
async function handleHubExplProdModal(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_prodmodal_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }

  const nom   = interaction.fields.getTextInputValue('nom').trim().slice(0, 60);
  const prix  = interaction.fields.getTextInputValue('prix').trim().slice(0, 15);
  const unite = interaction.fields.getTextInputValue('unite').trim().slice(0, 10);
  const produit = (nom + ' : ' + prix + ' ' + unite).slice(0, 100);

  const produits = [...(exploit.produits || [])];
  if (produits.length >= 25) {
    await interaction.reply({ content: '❌ Limite de 25 produits atteinte.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if (!produits.some(p => p.toLowerCase() === produit.toLowerCase())) produits.push(produit);

  exp.updateExploitation(exploitId, { produits });
  const updated = Object.values(exp.load()).find(e => e.id === exploitId);

  if (interaction.isFromMessage()) await interaction.update(produitsView(updated));
  else { await interaction.reply({ ...produitsView(updated), flags: 64 }); autoClean(interaction, 120000); }
}

// ── Select retrait produit ────────────────────────────────────────────────
async function handleHubExplProdDel(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_proddel_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const idx = parseInt(interaction.values[0], 10);
  const produits = [...(exploit.produits || [])];
  if (idx >= 0 && idx < produits.length) produits.splice(idx, 1);

  exp.updateExploitation(exploitId, { produits });
  const updated = Object.values(exp.load()).find(e => e.id === exploitId);
  await interaction.update(produitsView(updated));
}

// ── Bouton « Terminé » → retour au menu de gestion ────────────────────────
async function handleHubExplDone(interaction) {
  const ownerId = interaction.customId.replace('hub_expl_done_', '');
  const exploit = exp.getByOwner(ownerId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '✅ Terminé.', color: 0x2ECC71 }], components: [] }); autoClean(interaction); return; }
  await interaction.update(manageMenu(exploit));
}

// ── Select retrait ouvrier ──────────────────────────────────────────────────
async function handleHubExplOuvDel(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_ouvdel_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.update({ embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const ouvrierId = interaction.values[0];
  const idx = exploit.ouvriers.indexOf(ouvrierId);
  if (idx !== -1) {
    exploit.ouvriers.splice(idx, 1);
    exploit.ouvrierTags.splice(idx, 1);
    exp.updateExploitation(exploit.id, { ouvriers: exploit.ouvriers, ouvrierTags: exploit.ouvrierTags });
  }
  await interaction.update({ embeds: [{ description: '✅ Ouvrier retiré de **' + exploit.nom + '**.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
}

// ═══ BOUTON « Annuaire » (ON = affiche la liste globale, OFF = l'efface) ═══
async function handleHubAnnuaire(interaction) {
  const all = exp.getAll().filter(e => e.nom).sort((a, b) => a.nom.localeCompare(b.nom));
  if (all.length === 0) {
    await interaction.reply({ embeds: [{ description: '📭 Aucune exploitation enregistrée pour le moment.', color: 0x95A5A6 }], flags: 64 });
    autoClean(interaction, 30000);
    return;
  }

  // Un EMBED distinct par exploitation → chacune a sa propre barre de couleur (bien séparées)
  const DIV = '━━━━━━━━━━━━━━━━━━━━━━━';
  const MAX = 9; // 9 exploitations + 1 embed d'en-tête = 10 (limite Discord)
  const recr = all.filter(e => e.recrute).length;
  const shown = all.slice(0, MAX);
  const reste = all.length - shown.length;

  const header = {
    title: '📖  ANNUAIRE DES EXPLOITATIONS — EURO-AGRI',
    description: '**' + all.length + '** exploitation(s) sur le serveur  ·  **' + recr + '** en recrutement.'
      + (reste > 0 ? '\n\n⚠️ *' + reste + ' exploitation(s) non affichée(s) (trop pour un seul message).*' : ''),
    color: 0x1F8B4C,
  };

  const cartes = shown.map(e => {
    const hasO = e.ouvriers?.length > 0;
    const acts = [e.activitePrincipale, e.activiteSecondaire, hasO ? e.activiteSupplementaire : null]
      .filter(Boolean).join(' · ') || 'aucune activité définie';
    const nbOuv = e.ouvriers?.length || 0;
    const ouv = hasO ? e.ouvriers.map(id => '<@' + id + '>').join(', ') : 'Aucun ouvrier actuellement';
    const dateCrea = new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const prodBloc = e.produits?.length
      ? e.produits.map(p => '• ' + p).join('\n')
      : '*Aucun produit ni prestation pour le moment.*';

    return {
      title: '🌾  ' + e.nom,
      description: [
        '📢 **RECRUTEMENT :** ' + (e.recrute ? '🟢 OUI' : '🔴 NON'),
        '👤 **Exploitant :** <@' + e.ownerId + '>　│　📅 **Créée le :** ' + dateCrea,
        '',
        '🚜 **Activités :** ' + acts,
        '👷 **Ouvriers :** ' + nbOuv + ' — ' + ouv,
        '',
        DIV,
        '',
        '**🛒 Produits & prestations :**',
        prodBloc,
      ].join('\n').slice(0, 4096),
      color: e.recrute ? 0x2ECC71 : 0x57606A,
    };
  });

  await interaction.reply({
    embeds: [header, ...cartes],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_annuaire_off').setLabel('📖 Annuaire · OFF').setStyle(ButtonStyle.Danger),
    )],
    flags: 64,
  });
  autoClean(interaction, 15 * 60 * 1000);
}

// Bouton OFF → efface l'annuaire du joueur
async function handleHubAnnuaireOff(interaction) {
  await interaction.deferUpdate();
  await interaction.deleteReply().catch(() => {});
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function canManage(interaction, ownerId) {
  return interaction.user.id === ownerId
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  HUB_CHANNEL, EXPLOITANT_ROLE_ID, ACTIVITES,
  postHub,
  handleHubExpl, handleHubExplCreer, handleHubExplCreerModal,
  handleHubExplManage, handleHubExplSetAct, handleHubExplNom,
  handleHubExplOuvAdd, handleHubExplOuvDel, handleHubAnnuaire, handleHubAnnuaireOff,
  handleHubExplRecrute, handleHubExplProdAdd, handleHubExplProdModal,
  handleHubExplProdDel, handleHubExplDone,
};
