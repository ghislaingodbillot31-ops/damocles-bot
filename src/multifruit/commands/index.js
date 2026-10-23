// Slash commands de Multifruit.
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const jeu = require('../systems/jeu');
const V   = require('../ui/vues');

const CAT_NOM = '🍹 Multifruit';
const SALONS = [
  { cle: 'annonces',    nom: '📢-annonces' },
  { cle: 'hub',         nom: '🏭-hub' },
  { cle: 'tarifs',      nom: '💶-tarifs-économie' },
  { cle: 'marche',      nom: '🛒-marché' },
  { cle: 'classements', nom: '🏆-classements' },
];

const data = [
  new SlashCommandBuilder().setName('hub').setDescription('Ouvre le HUB de ton entreprise de jus (Multifruit)'),
  new SlashCommandBuilder().setName('creer-entreprise').setDescription('Crée ton entreprise de jus (Multifruit)'),
  new SlashCommandBuilder().setName('multifruit-installer').setDescription('Crée la catégorie et les salons de Multifruit (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(c => c.toJSON());

// Retrouve ou crée la catégorie + salons (lecture seule pour les joueurs), puis publie le panneau du hub (modifié sur place).
// Publie (ou modifie sur place) le panneau des classements dans 🏆-classements.
async function publierClassements(g) {
  const salon = g.channels.cache.get(jeu.lireConfig('salon_classements'));
  if (!salon) return;
  const id = jeu.lireConfig('panneau_classements');
  const msg = id && await salon.messages.fetch(id).catch(() => null);
  const m = msg ? await msg.edit(V.panneauClassements()) : await salon.send(V.panneauClassements());
  jeu.ecrireConfig('panneau_classements', m.id);
}

// Publie (ou modifie sur place) les promotions dans 🛒-marché.
async function publierMarche(g) {
  const salon = g.channels.cache.get(jeu.lireConfig('salon_marche'));
  if (!salon) return;
  const id = jeu.lireConfig('panneau_marche');
  const msg = id && await salon.messages.fetch(id).catch(() => null);
  const m = msg ? await msg.edit(V.panneauMarche()) : await salon.send(V.panneauMarche());
  jeu.ecrireConfig('panneau_marche', m.id);
}

async function installerServeur(g) {
  const P = PermissionFlagsBits;
  const lectureSeule = [
    { id: g.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] },
    { id: g.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageMessages] },
  ];
  const cat = g.channels.cache.get(jeu.lireConfig('categorie'))
    || g.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CAT_NOM)
    || await g.channels.create({ name: CAT_NOM, type: ChannelType.GuildCategory, reason: 'Multifruit' });
  jeu.ecrireConfig('categorie', cat.id);
  const salons = {};
  for (const s of SALONS) {
    salons[s.cle] = g.channels.cache.get(jeu.lireConfig('salon_' + s.cle))
      || g.channels.cache.find(c => c.parentId === cat.id && c.name === s.nom)
      || await g.channels.create({ name: s.nom, type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: lectureSeule, reason: 'Multifruit' });
    jeu.ecrireConfig('salon_' + s.cle, salons[s.cle].id);
  }
  // HUB GÉNÉRAL au-dessus, HUB entreprise en dessous : si le général manque, on republie les deux dans l'ordre.
  const gId = jeu.lireConfig('panneau_general');
  const general = gId && await salons.hub.messages.fetch(gId).catch(() => null);
  const msgId = jeu.lireConfig('panneau_hub');
  let existant = msgId && await salons.hub.messages.fetch(msgId).catch(() => null);
  if (general) await general.edit(V.panneauGeneral());
  else {
    if (existant) { await existant.delete().catch(() => {}); existant = null; }
    jeu.ecrireConfig('panneau_general', (await salons.hub.send(V.panneauGeneral())).id);
  }
  const msg = existant ? await existant.edit(V.panneauSalon()) : await salons.hub.send(V.panneauSalon());
  jeu.ecrireConfig('panneau_hub', msg.id);
  const tId = jeu.lireConfig('panneau_tarifs');
  const tMsg = tId && await salons.tarifs.messages.fetch(tId).catch(() => null);
  const t = tMsg ? await tMsg.edit(V.panneauTarifs()) : await salons.tarifs.send(V.panneauTarifs());
  jeu.ecrireConfig('panneau_tarifs', t.id);
  await publierClassements(g);
  await publierMarche(g);
  return `✅ Multifruit installé dans ${cat} — panneau publié dans ${salons.hub}.`;
}

async function installer(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply(await installerServeur(interaction.guild));
}

async function executer(interaction) {
  const nom = interaction.commandName;
  if (nom === 'multifruit-installer') return installer(interaction);
  if (nom === 'hub') {
    if (!jeu.entreprise(interaction.user.id)) return interaction.reply({ content: "❌ Tu n'as pas encore d'entreprise : utilise `/creer-entreprise`.", flags: MessageFlags.Ephemeral });
    return interaction.reply({ ...V.vueHub(jeu.etat(interaction.user.id)), flags: MessageFlags.Ephemeral });
  }
  if (nom === 'creer-entreprise') {
    if (jeu.entreprise(interaction.user.id)) return interaction.reply({ content: '❌ Tu as déjà une entreprise : ouvre-la avec `/hub`.', flags: MessageFlags.Ephemeral });
    return interaction.showModal(new ModalBuilder().setCustomId('mf:creer_modal').setTitle('Créer mon entreprise').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel("Nom de l'entreprise")
        .setPlaceholder('Ex. : Les Vergers du Coin').setStyle(TextInputStyle.Short).setRequired(true))));
  }
}

module.exports = { data, executer, installerServeur, publierClassements, publierMarche };
