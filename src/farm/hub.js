const fs = require('fs');
const ids = require('../core/ids');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const exp = require('./exploitation');
const { agrilog } = require('../core/agrilog');
const { panneau } = require('../core/embed-format');

// ── Config ────────────────────────────────────────────────────────────────────
const EXPLOITANT_ROLE_ID = ids('EXPLOITANT_ROLE_ID');

// Activités choisissables (liste du serveur, voir droits-texte.js) : le nom est enregistré dans la fiche
const ACTIVITES = require('./droits-texte').CHOIX.map(a => ({ label: a.emoji + ' ' + a.nom, value: a.nom }));
const choixActivites = champ => require('./droits-texte').choixPour(champ);

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

// ═══ BOUTON « Mon exploitation » ════════════════════════════════════════════
async function handleHubExpl(interaction) {
  const uid  = interaction.user.id;
  const list = managedExploitations(uid);

  if (!list.length) return handleHubExplCreer(interaction); // pas encore de ferme : menu déroulant des exploitations du serveur, directement

  // Une carte distincte (couleur, menu) par exploitation gérée
  await interaction.reply({ natif: true, ...manageMenu(list[0], uid, { i: 1, n: list.length }), flags: 64 });
  autoClean(interaction, 120000);
  for (const [k, e] of list.slice(1).entries()) {
    const m = await interaction.followUp({ natif: true, ...manageMenu(e, uid, { i: k + 2, n: list.length }), flags: 64 });
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
    { label: '🥇 Activité 1 (cultures)',      value: 'principale' },
    { label: '🥈 Activité 2 (élevage)',      value: 'secondaire' },
    hasOuvriers
      ? { label: '🥉 Activité supplémentaire', value: 'supplementaire' }
      : { label: '🥉 Activité supplémentaire', value: 'supplementaire', description: '🔒 Nécessite un ouvrier' },
    { label: '🧑‍🌾 Recrutement (oui / non)', value: 'recrute' },
    { label: '🎨 Couleur de l\'exploitation', value: 'couleur' },
    { label: '➕ Ajouter un ouvrier',        value: 'ouvrier_add' },
    { label: '📜 Mes droits',                value: 'droits', description: 'Travaux autorisés selon l\'activité' },
  ];
  if (hasOuvriers) options.push({ label: '➖ Retirer un ouvrier', value: 'ouvrier_del' });
  if (isOwner && !hasCo) options.push({ label: '🤝 Ajouter un co-exploitant', value: 'coexpl_add' });
  if (isOwner && hasCo)  options.push({ label: '➖ Retirer le co-exploitant', value: 'coexpl_del' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_manage_' + exploit.id) // par id d'exploitation : un joueur peut en posséder plusieurs (attribution admin)
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
            '🥇 **Activité 1 :** ' + (exploit.activitePrincipale || '*Non définie*'),
            '🥈 **Activité 2 :** ' + (exploit.activiteSecondaire || '*Non définie*'),
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
// Fermes du serveur FS25 pas encore prises par une exploitation (le nom de la ferme = le nom de l'exploitation)
function fermesLibres() {
  const st = require('./fs25-succes').getStatus();
  if (!st) return null;
  const prises = exp.getAll().map(e => e.nom.trim().toLowerCase());
  return st.farms.filter(f => !require('./niveaux').estForet(f) && !prises.includes(f.name.trim().toLowerCase()));
}

async function handleHubExplCreer(interaction) {
  if (exp.getByOwner(interaction.user.id)) return interaction.reply({ content: '❌ Tu as déjà une exploitation.', flags: 64 });
  const libres = fermesLibres();
  if (!libres) return interaction.reply({ content: '⏳ Pas encore de données du serveur FS25, réessaie dans une minute.', flags: 64 });
  if (!libres.length) return interaction.reply({ content: '❌ Aucune exploitation libre en jeu. Crée d\'abord ta ferme sur le serveur FS25.', flags: 64 });
  await interaction.reply({
    natif: true,
    embeds: [{ title: '🌾 Créer mon exploitation', description: 'Choisis **ta ferme** dans la liste des exploitations présentes en jeu :', color: 0x5865F2 }],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('hub_expl_creerfarm').setPlaceholder('🌾 Quelle exploitation est la tienne ?')
        .addOptions(libres.slice(0, 25).map(f => ({ label: f.name.slice(0, 100), value: String(f.id) })))),
    ],
    flags: 64,
  });
  autoClean(interaction, 120000);
}

// ── Menu : ferme choisie → création ─────────────────────────────────────────
async function handleHubExplCreerModal(interaction) {
  const farm = fermesLibres()?.find(f => String(f.id) === interaction.values[0]);
  if (!farm) return interaction.update({ content: '❌ Cette exploitation n\'est plus disponible.', embeds: [], components: [] });
  const nom = farm.name.trim();

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

  await interaction.deferUpdate();
  const exploitation = exp.createExploitation(interaction.user.id, interaction.user.tag, nom);
  await interaction.member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});

  await agrilog(interaction.guild, '🌾 Nouvelle exploitation : **' + nom + '** par <@' + interaction.user.id + '>');

  // Attribution directe : salon privé créé (HUB + travaux autorisés), la ferme apparaît aussi dans le salon liste (mise à jour par hub2)
  const salon = await require('./salon-exploitation').ensure(interaction.client, exploitation).catch(err => { console.error('⚠️ Salon exploitation :', err.message); return null; });
  await interaction.editReply({ natif: true, content: '', embeds: [{ title: '🌾 ' + nom, description: '✅ Cette exploitation t\'est attribuée, rôle **Exploitant** donné.' + (salon ? '\n🔒 Ton salon privé : <#' + salon.id + '>' : ''), color: 0x2ECC71 }], components: [] });
  autoClean(interaction, 30000);
}

// Bouton « ⚙️ Gérer mon exploitation » du salon privé : ouvre le menu de gestion
async function handleHubExplGerer(interaction) {
  const exploit = exp.getById(interaction.customId.replace('hub_expl_gerer_', ''));
  if (!exploit) return interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 });
  if (!canManage(interaction, exploit)) return interaction.reply({ content: '❌ Seul un exploitant (ou un admin) peut gérer cette exploitation.', flags: 64 });
  await interaction.reply({ natif: true, ...manageMenu(exploit, interaction.user.id), flags: 64 });
  autoClean(interaction, 120000);
}

// ── Select du menu de gestion ───────────────────────────────────────────────
async function handleHubExplManage(interaction) {
  const ref = interaction.customId.replace('hub_expl_manage_', '');
  const exploit = exp.getById(ref) || exp.getByOwner(ref); // getByOwner : anciens menus déjà postés
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  if (!canManage(interaction, exploit)) {
    await interaction.reply({ content: '❌ Seul un exploitant (ou un admin) peut gérer cette exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const choice = interaction.values[0];

  if (choice === 'droits') {
    await interaction.reply({ natif: true, ...require('./droits-texte').payload(), flags: 64 });
    return;
  }

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
      natif: true, embeds: [{ title: '🧑‍🌾 Recrutement · ' + exploit.nom, description: 'Est-ce que ton exploitation recrute ?', color: 0x5865F2 }],
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
      natif: true, embeds: [{ title: '🎨 Couleur · ' + exploit.nom, description: 'Choisis la couleur des embeds de ton exploitation (fiche, annuaire, annonces).', color: exploit.couleur ?? DEFAULT_COLOR }],
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
      natif: true, embeds: [{ title: '🤝 Ajouter un co-exploitant · ' + exploit.nom,
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
      natif: true, embeds: [{ title: '➖ Retirer le co-exploitant · ' + exploit.nom, color: 0xE74C3C }],
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
      natif: true, embeds: [{ title: '➕ Ajouter un ouvrier · ' + exploit.nom, description: 'Sélectionne le joueur (tu peux le chercher avec @).', color: 0x2ECC71 }],
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
      natif: true, embeds: [{ title: '➖ Retirer un ouvrier · ' + exploit.nom, color: 0xE74C3C }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  // principale / secondaire / supplementaire
  const menu = new StringSelectMenuBuilder()
    .setCustomId('hub_expl_setact_' + exploit.id + '_' + choice + '_edit')
    .setPlaceholder(choice === 'secondaire' ? 'Choisis ton activité 2 (élevage)...' : choice === 'principale' ? 'Choisis ton activité 1 (cultures)...' : 'Choisis une activité...')
    .addOptions(choixActivites(choice));
  await interaction.update({
    natif: true, embeds: [{ title: '✏️ ' + exploit.nom, description: 'Choisis la nouvelle activité :', color: 0x5865F2 }],
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
      .setPlaceholder('Choisis ton activité 2 (élevage)...')
      .addOptions(choixActivites('secondaire'));
    await interaction.update({
      natif: true, embeds: [{ title: '✅ Activité principale enregistrée', description: 'Choisis ton **activité 2 (élevage)** :', color: 0x2ECC71 }],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    return;
  }

  await interaction.update({
    natif: true, embeds: [{ description: mode === 'setup'
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
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const id     = interaction.values[0];
  const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
  if (!member) {
    await interaction.update({ natif: true, embeds: [{ description: '❌ Joueur introuvable sur le serveur.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }
  if (member.user.bot) {
    await interaction.update({ natif: true, embeds: [{ description: '❌ Impossible d\'ajouter un bot.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }
  if (exploit.ouvriers?.includes(id)) {
    await interaction.update({ natif: true, embeds: [{ description: '❌ **' + member.user.username + '** est déjà ouvrier.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }

  exp.addOuvrier(exploit.id, id, member.user.tag);
  await interaction.update({ natif: true, embeds: [{ description: '✅ **' + member.user.username + '** ajouté comme ouvrier à **' + exploit.nom + '**.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
}

// ── Select Oui/Non recrutement ─────────────────────────────────────────────
async function handleHubExplRecrute(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_recrute_', '');
  const exploit   = Object.values(exp.load()).find(e => e.id === exploitId);
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  const recrute = interaction.values[0] === 'oui';
  exp.updateExploitation(exploitId, { recrute });
  await interaction.update({
    natif: true, embeds: [{ description: recrute ? '✅ Recrutement **ouvert**.' : '✅ Recrutement **fermé**.', color: 0x2ECC71 }],
    components: [],
  });
  autoClean(interaction);
}

// ── Select retrait ouvrier ──────────────────────────────────────────────────
async function handleHubExplOuvDel(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_ouvdel_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }

  exp.removeOuvrier(exploit.id, interaction.values[0]);
  await interaction.update({ natif: true, embeds: [{ description: '✅ Ouvrier retiré de **' + exploit.nom + '**.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
}

// ── Select couleur ────────────────────────────────────────────────────────
async function handleHubExplCouleur(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_couleur_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (!canManage(interaction, exploit)) {
    await interaction.reply({ content: '❌ Réservé aux exploitants.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const couleur = parseInt(interaction.values[0], 10);
  exp.updateExploitation(exploitId, { couleur });
  await interaction.update({ natif: true, embeds: [{ description: '✅ Couleur de l\'exploitation mise à jour.', color: couleur }], components: [] });
  autoClean(interaction);
}

// ── Select utilisateur → ajout co-exploitant (créateur uniquement) ────────
async function handleHubExplCoAdd(interaction) {
  const exploitId = interaction.customId.replace('hub_expl_coadd_', '');
  const exploit   = exp.getById(exploitId);
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (interaction.user.id !== exploit.ownerId) {
    await interaction.reply({ content: '❌ Seul le créateur peut ajouter un co-exploitant.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if ((exploit.coExploitants?.length || 0) >= 1) {
    await interaction.update({ natif: true, embeds: [{ description: '❌ Il y a déjà un co-exploitant. Retire-le d\'abord.', color: 0xE74C3C }], components: [] });
    autoClean(interaction);
    return;
  }

  const id = interaction.values[0];
  const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
  if (!member)               { await interaction.update({ natif: true, embeds: [{ description: '❌ Joueur introuvable sur le serveur.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }
  if (member.user.bot)       { await interaction.update({ natif: true, embeds: [{ description: '❌ Impossible d\'ajouter un bot.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }
  if (id === exploit.ownerId){ await interaction.update({ natif: true, embeds: [{ description: '❌ Tu es déjà le créateur.', color: 0xE74C3C }], components: [] }); autoClean(interaction); return; }

  const wasOuvrier = (exploit.ouvriers || []).includes(id);
  exp.addCoExploitant(exploit.id, id, member.user.tag);
  await member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});

  await interaction.update({ natif: true, embeds: [{
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
  if (!exploit) { await interaction.update({ natif: true, embeds: [{ description: '❌ Exploitation introuvable.', color: 0xE74C3C }], components: [] }); return; }
  if (interaction.user.id !== exploit.ownerId) {
    await interaction.reply({ content: '❌ Seul le créateur peut retirer le co-exploitant.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const coId = interaction.values[0];
  exp.removeCoExploitant(exploit.id, coId);
  await interaction.update({ natif: true, embeds: [{ description: '✅ Co-exploitant retiré de **' + exploit.nom + '**. *(Le rôle Discord Exploitant est conservé.)*', color: 0x2ECC71 }], components: [] });
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
  const estElevage = a => require('./droits-texte').parNom(a)?.groupe === 'elevage';
  const elevage = acts.filter(estElevage);
  const autres  = acts.filter(a => !estElevage(a));
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
  const vis = require('../core/database').idsVisibles();
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
    const del = shown.map(e => new ButtonBuilder().setCustomId('hub_annuaire_adm_' + e.id).setLabel('⚙️ ' + e.nom.slice(0, 20)).setStyle(ButtonStyle.Secondary));
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
  await interaction.reply({ natif: true, ...view, flags: 64 });
  autoClean(interaction, empty ? 30000 : 15 * 60 * 1000);
}

// Bouton OFF → efface l'annuaire du joueur
async function handleHubAnnuaireOff(interaction) {
  await interaction.deferUpdate();
  await interaction.deleteReply().catch(() => {});
}

// ── Panneau admin d'une exploitation : changer le propriétaire / supprimer ──
async function handleHubAnnuaireAdm(interaction) {
  if (!isAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  // Depuis l'annuaire (message éphémère) on édite en place ; depuis la case du salon liste (message public) on répond en éphémère.
  const depuisCase = interaction.customId.startsWith('hub_expl_adm_');
  const id = interaction.customId.replace(/^hub_(annuaire|expl)_adm_/, '');
  const e = exploitOuFerme(id);
  if (!e) { await interaction.reply({ content: '❌ Exploitation introuvable.', flags: 64 }); autoClean(interaction); return; }
  const rows = [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('hub_expl_admowner_' + id).setPlaceholder('👑 Nouveau propriétaire...').setMaxValues(1))];
  if (!depuisCase) rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_annuaire_del_' + id).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('hub_annuaire_delno_' + id).setLabel('⬅️ Retour').setStyle(ButtonStyle.Secondary),
  ));
  const view = { natif: true, embeds: [{ title: '⚙️ Admin · ' + e.nom, description: '👑 Propriétaire actuel : ' + (e.ownerId ? '<@' + e.ownerId + '>' : '*aucun (ferme sans fiche)*') + '\nChoisis le **' + (e.ownerId ? 'nouveau ' : '') + 'propriétaire** ci-dessous.', color: 0xE67E22 }], components: rows };
  if (depuisCase) { await interaction.reply({ ...view, flags: 64 }); autoClean(interaction, 120000); }
  else await interaction.update(view);
}

// « farm_<id> » = ferme du jeu sans fiche : exploitation virtuelle (ownerId null), créée au choix du propriétaire.
function exploitOuFerme(id) {
  if (!id.startsWith('farm_')) return exp.getById(id);
  const f = require('./fs25-succes').getStatus()?.farms.find(x => 'farm_' + x.id === id);
  return f && !exp.getByName(f.name.trim()) ? { id, nom: f.name.trim(), ownerId: null } : null;
}

// User select → transfert de propriété (le nouveau remplace l'ancien, qui sort de l'exploitation).
async function handleHubExplAdmOwner(interaction) {
  if (!isAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  let e = exploitOuFerme(interaction.customId.replace('hub_expl_admowner_', ''));
  const fail = async d => { await interaction.update({ natif: true, embeds: [{ description: '❌ ' + d, color: 0xE74C3C }], components: [] }); autoClean(interaction); };
  if (!e) return fail('Exploitation introuvable.');
  const uid = interaction.values[0];
  const member = interaction.guild.members.cache.get(uid) || await interaction.guild.members.fetch(uid).catch(() => null);
  if (!member) return fail('Joueur introuvable sur le serveur.');
  if (member.user.bot) return fail('Impossible de choisir un bot.');
  if (uid === e.ownerId) return fail('Il est déjà propriétaire.');

  const old = e.ownerId;
  if (!old) { // ferme sans fiche : on la crée
    e = exp.createExploitation(uid, member.user.tag, e.nom);
    await member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});
    require('./salon-exploitation').ensure(interaction.client, e).catch(() => {});
    await interaction.update({ natif: true, embeds: [{ description: '✅ **' + e.nom + '** : <@' + uid + '> est maintenant propriétaire.', color: 0x2ECC71 }], components: [] });
    autoClean(interaction);
    await agrilog(interaction.guild, '👑 **' + e.nom + '** : propriétaire <@' + uid + '> (fiche créée) · par <@' + interaction.user.id + '>');
    return;
  }
  exp.setOwner(e.id, uid, member.user.tag);
  await member.roles.add(EXPLOITANT_ROLE_ID).catch(() => {});
  await interaction.update({ natif: true, embeds: [{ description: '✅ **' + e.nom + '** : <@' + uid + '> remplace <@' + old + '> comme propriétaire.', color: 0x2ECC71 }], components: [] });
  autoClean(interaction);
  await agrilog(interaction.guild, '👑 **' + e.nom + '** : propriétaire <@' + old + '> → <@' + uid + '> · par <@' + interaction.user.id + '>');
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
    natif: true, embeds: [{
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
    await require('./salon-exploitation').supprimer(interaction.client, exploit);
    exp.deleteExploitation(id);
    await agrilog(interaction.guild, '🗑️ Exploitation supprimée : **' + exploit.nom + '** (créateur <@' + exploit.ownerId + '>) · par <@' + interaction.user.id + '>');
  }
  const { empty, ...view } = renderAnnuaire(true);
  await interaction.update({ natif: true, ...view });
}

// Étape 2b : annulation → retour à l'annuaire sans rien supprimer.
async function handleHubAnnuaireDelNo(interaction) {
  const { empty, ...view } = renderAnnuaire(isAdmin(interaction));
  await interaction.update({ natif: true, ...view });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// Peut gérer la fiche = exploitant (créateur ou co-exploitant) ou admin serveur.
function canManage(interaction, exploit) {
  return exp.isManager(exploit, interaction.user.id)
    || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  EXPLOITANT_ROLE_ID, ACTIVITES,
  handleHubExpl, handleHubExplGerer, handleHubExplCreer, handleHubExplCreerModal,
  handleHubExplManage, handleHubExplSetAct, handleHubExplNom,
  handleHubExplOuvAdd, handleHubExplOuvDel, handleHubAnnuaire, handleHubAnnuaireOff,
  handleHubAnnuaireAdm, handleHubExplAdmOwner,
  handleHubAnnuaireDel, handleHubAnnuaireDelYes, handleHubAnnuaireDelNo,
  handleHubExplRecrute, handleHubExplCouleur, handleHubExplCoAdd, handleHubExplCoDel,
};
