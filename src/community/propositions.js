const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const ids = require('../core/ids');
const { panneau } = require('../core/embed-format');
const { dataPath } = require('../core/paths');

// Salon de suggestions (MODS_CHANNEL_ID, ancien salon des propositions de mods) :
// le HUB propose une catégorie, le joueur écrit un titre et une description (200 caractères max),
// la suggestion est publiée avec les boutons 👍 Pour / 👎 Contre et 👥 Votants (qui a voté quoi).
const CHANNEL = ids('MODS_CHANNEL_ID');
const STORE_PATH = dataPath('propositions.json');
const MAX_DESC = 200;

const CATEGORIES = {
  mod:          { emoji: '🧩', label: 'Mod',          color: 0x3498DB },
  regle:        { emoji: '📜', label: 'Règle',        color: 0xE67E22 },
  amelioration: { emoji: '🚀', label: 'Amélioration', color: 0x2ECC71 },
  divers:       { emoji: '💬', label: 'Divers',       color: 0x95A5A6 },
};

// { panelMsgId, next, items: { n: { userId, cat, titre, texte, msgId, votes: { userId: 'pour'|'contre' }, status, createdAt } } }
let store = { panelMsgId: null, next: 1, items: {} };
const load = () => { try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {} };
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const salon = client => client.channels.cache.get(CHANNEL) || client.channels.fetch(CHANNEL).catch(() => null);

function hubPayload() {
  return panneau({
    embeds: [{
      title: '💡  SUGGESTIONS',
      description: [
        'Une idée pour le serveur ? Choisis une **catégorie** dans le menu ci-dessous, puis écris un titre et quelques détails (**' + MAX_DESC + ' caractères maximum**).',
        '',
        ...Object.values(CATEGORIES).map(c => c.emoji + ' **' + c.label + '**'),
        '',
        'Les joueurs votent **👍 Pour** ou **👎 Contre** · le bouton **👥 Votants** montre qui a voté quoi.',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('prop_cat').setPlaceholder('📝 Choisis une catégorie…')
        .addOptions(Object.entries(CATEGORIES).map(([value, c]) => ({ label: c.label, value, emoji: c.emoji }))),
    )],
  });
}

const compte = (s, v) => Object.values(s.votes).filter(x => x === v).length;

function suggPayload(n, s) {
  const c = CATEGORIES[s.cat] || CATEGORIES.divers;
  return {
    content: '',
    ...panneau({ embeds: [{
      title: c.emoji + ' ' + c.label + ' · ' + s.titre,
      description: 'Proposée par <@' + s.userId + '>\n\n' + s.texte,
      color: c.color,
      footer: { text: 'Suggestion n°' + n },
      timestamp: new Date(s.createdAt).toISOString(),
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prop_pour_' + n).setLabel('👍 Pour · ' + compte(s, 'pour')).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('prop_contre_' + n).setLabel('👎 Contre · ' + compte(s, 'contre')).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('prop_votants_' + n).setLabel('👥 Votants').setStyle(ButtonStyle.Secondary),
    )],
    allowedMentions: { parse: [] },
  };
}

// HUB en tête : mis à jour sur place s'il existe ; l'ancien panneau « propositions de mods » est supprimé.
async function installerHub(channel) {
  const anciens = [...(await channel.messages.fetch({ limit: 100 }).catch(() => new Map())).values()]
    .filter(m => m.author.id === channel.client.user.id && m.components.some(r => r.components.some(b => b.customId?.startsWith('modprop_'))));
  for (const m of anciens) await m.delete().catch(() => {});
  const hub = store.panelMsgId && await channel.messages.fetch(store.panelMsgId).catch(() => null);
  if (hub && await hub.edit(hubPayload()).then(() => true, () => false)) return;
  const msg = await channel.send(hubPayload()).catch(err => { console.error('⚠️ Suggestions :', err.message); return null; });
  store.panelMsgId = msg?.id || null;
  save();
}

// Menu de catégorie -> formulaire (titre + description limitée à 200 caractères)
async function handleCategorie(interaction) {
  const cat = interaction.values[0];
  const c = CATEGORIES[cat];
  if (!c) return;
  await interaction.showModal(new ModalBuilder().setCustomId('prop_modal_' + cat).setTitle('Suggestion · ' + c.label).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titre').setLabel('Titre').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texte').setLabel('Détails (' + MAX_DESC + ' caractères max)').setStyle(TextInputStyle.Paragraph)
      .setMinLength(10).setMaxLength(MAX_DESC).setRequired(true)),
  ));
  // le menu reste sur « Choisis une catégorie » : on remet le message à neuf pour que le choix ne reste pas affiché
  await interaction.message?.edit(hubPayload()).catch(() => {});
}

async function handleModal(interaction) {
  const cat = interaction.customId.slice('prop_modal_'.length);
  if (!CATEGORIES[cat]) return;
  const titre = interaction.fields.getTextInputValue('titre').trim();
  const texte = interaction.fields.getTextInputValue('texte').trim().slice(0, MAX_DESC);
  if (!titre || !texte) return interaction.reply({ content: '❌ Le titre et les détails sont obligatoires.', flags: 64 });
  const channel = await salon(interaction.client);
  if (!channel) return interaction.reply({ content: '⚠️ Salon des suggestions introuvable.', flags: 64 });

  const n = store.next++;
  const s = { userId: interaction.user.id, cat, titre, texte, votes: {}, status: 'attente', createdAt: Date.now() };
  const msg = await channel.send(suggPayload(n, s)).catch(() => null);
  if (!msg) { store.next--; return interaction.reply({ content: '⚠️ Impossible de publier la suggestion.', flags: 64 }); }
  s.msgId = msg.id;
  store.items[n] = s;
  save();
  await interaction.reply({ content: '✅ Ta suggestion n°' + n + ' est publiée dans <#' + CHANNEL + '>.', flags: 64 });
}

// 👍 / 👎 : un vote par joueur ; recliquer sur le même bouton retire le vote, l'autre bouton le change.
async function handleVote(interaction) {
  const [, choix, n] = interaction.customId.split('_');
  const s = store.items[n];
  if (!s) return interaction.reply({ content: 'ℹ️ Suggestion introuvable.', flags: 64 });
  const uid = interaction.user.id;
  if (s.votes[uid] === choix) delete s.votes[uid]; else s.votes[uid] = choix;
  save();
  await interaction.update(suggPayload(n, s));
}

// 👥 Votants : qui a voté quoi (visible par le joueur seul)
async function handleVotants(interaction) {
  const n = interaction.customId.split('_')[2];
  const s = store.items[n];
  if (!s) return interaction.reply({ content: 'ℹ️ Suggestion introuvable.', flags: 64 });
  const liste = v => {
    const l = Object.entries(s.votes).filter(([, x]) => x === v).map(([u]) => '<@' + u + '>');
    return (l.join(' · ') || '_Personne_').slice(0, 1000);
  };
  await interaction.reply({
    natif: true, flags: 64, allowedMentions: { parse: [] },
    embeds: [{
      title: '👥 Votants · suggestion n°' + n + ' · ' + s.titre,
      color: 0x5865F2,
      fields: [
        { name: '👍 Pour (' + compte(s, 'pour') + ')', value: liste('pour') },
        { name: '👎 Contre (' + compte(s, 'contre') + ')', value: liste('contre') },
      ],
    }],
  });
}

// Dashboard : suppression définitive (message du salon + enregistrement)
async function supprimer(client, n) {
  const s = store.items[n];
  if (!s) throw new Error('Suggestion introuvable');
  const channel = s.msgId && await salon(client);
  const msg = channel && await channel.messages.fetch(s.msgId).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
  delete store.items[n];
  save();
}

async function startPropositions(client) {
  if (!CHANNEL) return;
  load();
  try {
    const channel = await salon(client);
    if (!channel) { console.error('⚠️ Suggestions : salon ' + CHANNEL + ' introuvable'); return; }
    await installerHub(channel);
    console.log('💡 Suggestions · prêt (' + Object.keys(store.items).length + ' suggestion(s))');
  } catch (err) { console.error('⚠️ Suggestions :', err.message); }
}

module.exports = { startPropositions, handleCategorie, handleModal, handleVote, handleVotants, supprimer, CATEGORIES, MAX_DESC, _store: () => store };
