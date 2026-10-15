const ids = require('./ids');
const fs = require('fs');
const {
  PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, FileUploadBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

// Signalement de bugs : le joueur remplit un formulaire dans le HUB, le signalement est publié
// dans « liste-de-bugs » (en attente). Un admin l'accepte (→ traitement en cours), puis le marque
// corrigé (→ bugs corrigés), ou le refuse. Le joueur est prévenu en MP à chaque étape.
// Salons : variable d'env si présente, sinon recherche par nom (mot-clé).
const SALONS = {
  hub:        { env: 'BUG_HUB_CHANNEL_ID',        mot: 'hub' },
  attente:    { env: 'BUGS_CONNUS_CHANNEL_ID',    mot: 'liste-de-bugs' },
  traitement: { env: 'BUGS_TRAITEMENT_CHANNEL_ID', mot: 'traitement' },
  corrige:    { env: 'BUGS_CORRIGES_CHANNEL_ID',  mot: 'corrig' },
};
const STORE_PATH  = dataPath('bugs.json');
const COOLDOWN_MS = 2 * 60 * 1000;

// [emoji, nom stocké (FR, lu par le staff), nom affiché en anglais]
const TYPES = [
  ['🎮', 'Gameplay', 'Gameplay'], ['🖼️', 'Graphique / visuel', 'Graphics / visual'], ['💰', 'Économie', 'Economy'],
  ['🌐', 'Connexion / serveur', 'Connection / server'], ['🧭', 'Interface', 'Interface'], ['🔊', 'Audio', 'Audio'],
  ['🔧', 'Correctif à établir', 'Fix needed'], ['📌', 'Autre', 'Other'],
];
const L = (en, fr, anglais) => en ? anglais : fr; // langue du joueur

const STATUTS = {
  attente:    { label: '⏳ En attente de validation', color: 0x5865F2 },
  traitement: { label: '🛠️ Traitement en cours', color: 0xE67E22 },
  corrige:    { label: '✅ Corrigé', color: 0x2ECC71 },
};

// { next, panelMsgId, items: { n: { lang, userId, type, region, texte, status, msgId, channelId, firstImage, createdAt, decidedBy, motif } } }
let store = { next: 1, panelMsgId: null, items: {} };
const derniere = new Map();

function load() {
  try { store = { next: 1, panelMsgId: null, items: {}, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
}
function save() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {}
}

const estAdmin = i => !!i.member?.permissions?.has(PermissionFlagsBits.Administrator);
const autoClean = (i, delay = 5000) => setTimeout(() => i.deleteReply().catch(() => {}), delay);

async function salon(client, cle) {
  const { env, mot } = SALONS[cle];
  const id = ids(env);
  if (id) return client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
  const guild = client.guilds.cache.get(process.env.GUILD_ID) || (client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first());
  await guild?.channels.fetch().catch(() => {});
  return guild?.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(mot)) || null;
}

// ── Fichiers ──────────────────────────────────────────────────────────────────
async function telecharger(url, name) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('téléchargement ' + r.status);
  return { attachment: Buffer.from(await r.arrayBuffer()), name };
}
// Les fichiers d'un message sont recopiés d'un salon à l'autre (les liens d'un formulaire expirent).
// La capture référencée par l'embed n'apparaît pas dans msg.attachments : on la reprend via l'embed.
const copier = (msg, nomImage) => Promise.all([
  ...(msg.embeds[0]?.image ? [telecharger(msg.embeds[0].image.url, nomImage)] : []),
  ...[...msg.attachments.values()].map(a => telecharger(a.url, a.name)),
]);

// ── Message d'un signalement ──────────────────────────────────────────────────
function bugPayload(n, b) {
  const st = STATUTS[b.status];
  let statut = st.label;
  if (b.decidedBy) statut += ' par <@' + b.decidedBy + '>';
  const embed = {
    title: '🐞 Bug n°' + n + ' · ' + b.type,
    description: 'Signalé par <@' + b.userId + '>\n\n' + b.texte,
    fields: [
      { name: '🗺️ Région', value: '**' + b.region + '**', inline: true },
      { name: '🏷️ Type', value: b.type, inline: true },
      { name: '📌 Statut', value: statut },
    ],
    color: st.color,
    timestamp: new Date(b.createdAt).toISOString(),
  };
  if (b.firstImage) embed.image = { url: 'attachment://' + b.firstImage };

  const bouton = (id, label, style) => new ButtonBuilder().setCustomId(id + '_' + n).setLabel(label).setStyle(style);
  const lignes = {
    attente: [bouton('bug_ok', '✅ Accepter', ButtonStyle.Success), bouton('bug_no', '❌ Refuser', ButtonStyle.Danger)],
    traitement: [bouton('bug_fix', '✔️ Marquer corrigé', ButtonStyle.Success)],
    corrige: [],
  }[b.status];
  return {
    content: '',
    ...panneau({ embeds: [embed] }),
    components: lignes.length ? [new ActionRowBuilder().addComponents(lignes)] : [],
    allowedMentions: { parse: [] },
  };
}

// ── HUB ───────────────────────────────────────────────────────────────────────
function panelPayload() {
  return panneau({
    embeds: [{
      title: '🐞  SIGNALER UN BUG · REPORT A BUG',
      description: [
        '🇫🇷 **Français**',
        'Tu as trouvé un bug ? Clique sur le bouton et remplis le formulaire : **type**, **numéro de la région**,',
        '**description** (étapes pour le reproduire), **capture d\'écran** (obligatoire) et **vidéo** (facultatif).',
        '',
        '🇬🇧 **English**',
        'Found a bug? Click the button and fill in the form: **type**, **region number**,',
        '**description** (steps to reproduce), **screenshot** (required) and **video** (optional).',
        '',
        'Tous les bugs sont listés dans **liste-de-bugs** · All bugs are listed in **liste-de-bugs**.',
        'Le staff les traite un par un · The staff handles them one by one. 📩 MP / DM',
      ].join('\n'),
      color: 0xE74C3C,
      footer: { text: 'Bug reports' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bug_new').setLabel('🇫🇷 Signaler un bug').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('bug_new_en').setLabel('🇬🇧 Report a bug').setStyle(ButtonStyle.Danger),
    )],
  });
}

async function installerHub(channel) {
  const hub = store.panelMsgId && await channel.messages.fetch(store.panelMsgId).catch(() => null);
  if (hub) { await hub.edit(panelPayload()).catch(() => {}); return; }
  const msg = await channel.send(panelPayload()).catch(err => { console.error('⚠️ Bugs :', err.message); return null; });
  store.panelMsgId = msg?.id || null;
  save();
}

// ── Bouton « Signaler un bug » → formulaire ──────────────────────────────────
async function handleBugNew(interaction) {
  const en = interaction.customId.endsWith('_en');
  const reste = COOLDOWN_MS - (Date.now() - (derniere.get(interaction.user.id) || 0));
  if (reste > 0) {
    await interaction.reply({ content: L(en, '⏳ Attends encore ' + Math.ceil(reste / 1000) + ' s avant un nouveau signalement.', '⏳ Please wait ' + Math.ceil(reste / 1000) + ' s before another report.'), flags: 64 });
    autoClean(interaction);
    return;
  }
  const modal = new ModalBuilder().setCustomId(en ? 'bug_modal_en' : 'bug_modal').setTitle(L(en, 'Signaler un bug', 'Report a bug')).addLabelComponents(
    new LabelBuilder().setLabel(L(en, 'Type de bug', 'Bug type')).setStringSelectMenuComponent(
      new StringSelectMenuBuilder().setCustomId('type').setPlaceholder(L(en, 'Choisis un type', 'Choose a type'))
        .addOptions(TYPES.map(([emoji, nom, anglais]) => ({ label: L(en, nom, anglais), value: nom, emoji }))),
    ),
    new LabelBuilder().setLabel(L(en, 'Numéro de la région', 'Region number')).setTextInputComponent(
      new TextInputBuilder().setCustomId('region').setStyle(TextInputStyle.Short).setMaxLength(4).setPlaceholder(L(en, 'Ex: 12', 'E.g. 12')).setRequired(true),
    ),
    new LabelBuilder().setLabel(L(en, 'Description du bug', 'Bug description')).setTextInputComponent(
      new TextInputBuilder().setCustomId('texte').setStyle(TextInputStyle.Paragraph).setMinLength(20).setMaxLength(1500).setRequired(true),
    ),
    new LabelBuilder().setLabel(L(en, 'Capture d\'écran (obligatoire, une seule)', 'Screenshot (required, only one)')).setFileUploadComponent(
      new FileUploadBuilder().setCustomId('capture').setMinValues(1).setMaxValues(1).setRequired(true),
    ),
    new LabelBuilder().setLabel(L(en, 'Vidéo (facultatif)', 'Video (optional)')).setFileUploadComponent(
      new FileUploadBuilder().setCustomId('video').setMinValues(0).setMaxValues(1).setRequired(false),
    ),
  );
  await interaction.showModal(modal);
}

async function handleBugModal(interaction) {
  const en = interaction.customId.endsWith('_en');
  await interaction.deferReply({ flags: 64 });
  const fin = (msg, delay = 8000) => interaction.editReply({ content: msg }).then(() => autoClean(interaction, delay));

  const type   = interaction.fields.getStringSelectValues('type')[0];
  const region = interaction.fields.getTextInputValue('region').trim();
  const texte  = interaction.fields.getTextInputValue('texte').trim();
  const captures = [...(interaction.fields.getUploadedFiles('capture')?.values() || [])];
  const videos   = [...(interaction.fields.getUploadedFiles('video')?.values() || [])];

  if (!type || !TYPES.some(t => t[1] === type)) return fin(L(en, '❌ Choisis un type de bug.', '❌ Choose a bug type.'));
  if (!/^\d{1,4}$/.test(region)) return fin(L(en, '❌ Le numéro de la région doit être un nombre (ex: 12).', '❌ The region number must be a number (e.g. 12).'));
  if (!captures.length || captures.some(a => !a.contentType?.startsWith('image/'))) return fin(L(en, '❌ Une capture d\'écran (image) est obligatoire.', '❌ A screenshot (image) is required.'));
  if (videos.some(a => !a.contentType?.startsWith('video/'))) return fin(L(en, '❌ Le fichier de la vidéo n\'est pas une vidéo.', '❌ The video file is not a video.'));

  const channel = await salon(interaction.client, 'attente');
  if (!channel) return fin(L(en, '⚠️ Salon des bugs connus introuvable.', '⚠️ Known-bugs channel not found.'));

  const ext = a => (a.name.match(/\.\w+$/) || [''])[0];
  let files;
  try {
    files = await Promise.all([
      ...captures.map((a, i) => telecharger(a.url, 'capture-' + (i + 1) + ext(a))),
      ...videos.map(a => telecharger(a.url, 'video' + ext(a))),
    ]);
  } catch (err) { return fin(L(en, '⚠️ Impossible de récupérer les fichiers : ', '⚠️ Could not retrieve the files: ') + err.message); }

  const n = store.next++;
  const b = { lang: en ? 'en' : 'fr', userId: interaction.user.id, type, region, texte, status: 'attente', firstImage: files[0].name, createdAt: Date.now() };
  let msg = await channel.send({ ...bugPayload(n, b), files }).catch(() => null);
  if (!msg && videos.length) { // vidéo probablement trop lourde : on publie sans elle
    msg = await channel.send({ ...bugPayload(n, b), files: files.slice(0, captures.length) }).catch(() => null);
    if (msg) await channel.send({ content: '⚠️ La vidéo du bug n°' + n + ' est trop lourde et n\'a pas pu être jointe.' }).catch(() => {});
  }
  if (!msg) { store.next--; return fin(L(en, '⚠️ Impossible de publier le signalement.', '⚠️ Could not publish the report.')); }

  b.msgId = msg.id; b.channelId = channel.id;
  store.items[n] = b;
  save();
  derniere.set(interaction.user.id, Date.now());
  await fin(L(en, '✅ Ton bug n°' + n + ' est publié dans <#' + channel.id + '>. Tu seras prévenu en MP à chaque étape.', '✅ Your bug #' + n + ' is posted in <#' + channel.id + '>. You will get a DM at every step.'));
}

// ── MP au joueur ──────────────────────────────────────────────────────────────
const EN_DM = {
  '🛠️ Ton bug est accepté': ['🛠️ Your bug was accepted', 'The staff **accepted** your report, it is now **in progress**.'],
  '✅ Ton bug est corrigé': ['✅ Your bug is fixed', 'Good news, this bug is **fixed**. Thanks for your report!'],
  '❌ Ton bug a été refusé': ['❌ Your bug was declined', 'The staff did not keep this report.'],
};
async function prevenir(client, b, n, titre, ligne, color) {
  const en = b.lang === 'en';
  if (en) {
    const [t, l] = EN_DM[titre];
    ligne = l + (b.motif && titre.startsWith('❌') ? '\n\n💬 **Staff reply:**\n' + b.motif : '');
    titre = t;
  }
  try {
    const user = await client.users.fetch(b.userId);
    await user.send(panneau({ embeds: [{
      title: titre,
      description: [L(en, '**Bug n°', '**Bug #') + n + '** · ' + b.type + L(en, ' · région ', ' · region ') + b.region, '', ligne].join('\n'),
      color,
    }] }));
  } catch { /* MP fermés */ }
}

// ── Décisions admin ───────────────────────────────────────────────────────────
async function handleBugDecision(interaction) {
  const [, action, num] = interaction.customId.split('_');
  const b = store.items[num];
  if (!estAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  const attendu = { ok: 'attente', no: 'attente', fix: 'traitement' }[action];
  if (!b || b.status !== attendu) { await interaction.reply({ content: 'ℹ️ Ce bug a déjà été traité.', flags: 64 }); autoClean(interaction); return; }

  if (action === 'no') {
    const modal = new ModalBuilder().setCustomId('bug_nomodal_' + num).setTitle('Refuser le bug n°' + num).addLabelComponents(
      new LabelBuilder().setLabel('Raison du refus (facultatif)').setTextInputComponent(
        new TextInputBuilder().setCustomId('motif').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false),
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  await interaction.deferReply({ flags: 64 });
  const vers = action === 'ok' ? 'traitement' : 'corrige';
  const channel = await salon(interaction.client, vers);
  if (!channel) { await interaction.editReply('⚠️ Salon de destination introuvable.'); autoClean(interaction); return; }

  const ancien = interaction.message;
  const nouveau = { ...b, status: vers, decidedBy: interaction.user.id };
  const files = await copier(ancien, b.firstImage).catch(() => null);
  const msg = files && await channel.send({ ...bugPayload(num, nouveau), files }).catch(() => null);
  if (!msg) { await interaction.editReply('⚠️ Impossible de déplacer le bug (fichiers trop lourds ou permission manquante).'); autoClean(interaction); return; }

  await ancien.delete().catch(() => {});
  Object.assign(b, nouveau, { msgId: msg.id, channelId: channel.id });
  save();
  await interaction.editReply('✅ Bug n°' + num + ' déplacé dans <#' + channel.id + '>.');
  autoClean(interaction);
  if (vers === 'traitement') await prevenir(interaction.client, b, num, '🛠️ Ton bug est accepté', 'Le staff a **accepté** ton signalement, il est maintenant en **traitement**.', 0xE67E22);
  else await prevenir(interaction.client, b, num, '✅ Ton bug est corrigé', 'Bonne nouvelle, ce bug est **corrigé**. Merci pour ton signalement !', 0x2ECC71);
}

async function handleBugRefus(interaction) {
  const num = interaction.customId.replace('bug_nomodal_', '');
  const b = store.items[num];
  if (!estAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  if (!b || b.status !== 'attente') { await interaction.reply({ content: 'ℹ️ Ce bug a déjà été traité.', flags: 64 }); autoClean(interaction); return; }

  b.status = 'refuse';
  b.decidedBy = interaction.user.id;
  b.motif = (interaction.fields.getTextInputValue('motif') || '').trim() || null;
  save();
  await interaction.reply({ content: '❌ Bug n°' + num + ' refusé. Le joueur est prévenu en MP.', flags: 64 });
  autoClean(interaction);
  await interaction.message?.delete().catch(() => {});
  await prevenir(interaction.client, b, num, '❌ Ton bug a été refusé',
    'Le staff n\'a pas retenu ce signalement.' + (b.motif ? '\n\n💬 **Réponse du staff :**\n' + b.motif : ''), 0xE74C3C);
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startBugs(client) {
  // Le signalement de bugs n'existe que sur le serveur qui définit BUG_HUB_CHANNEL_ID (pas de recherche par nom : sur VANGUARD il tomberait sur #fs25-hub).
  if (!ids('BUG_HUB_CHANNEL_ID')) return;
  load();
  try {
    const hub = await salon(client, 'hub');
    if (!hub) { console.error('⚠️ Bugs : salon HUB introuvable (BUG_HUB_CHANNEL_ID)'); return; }
    await installerHub(hub);
    console.log('🐞 Signalement de bugs · prêt (HUB : #' + hub.name + ')');
  } catch (err) {
    console.error('⚠️ Bugs :', err.message);
  }
}

module.exports = { startBugs, handleBugNew, handleBugModal, handleBugDecision, handleBugRefus };
