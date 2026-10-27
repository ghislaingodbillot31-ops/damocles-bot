const ids = require('./ids');
const fs = require('fs');
const {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');
const { agrilog } = require('./agrilog');

// Propositions de mods : panneau (règlement des mods) avec le bouton « Faire une proposition » dans le salon
// des suggestions. Chaque proposition y est publiée, un admin la valide ou la
// refuse (commentaire facultatif) et l'auteur reçoit la décision en MP.
// Deux HUB sur le même code : idées pour le jeu (SUGG_CHANNEL_ID, boutons sugg_) et propositions de mods
// (MODS_CHANNEL_ID, boutons modprop_), chacun avec son salon, son fichier et ses numéros.
function creer({ JEU, SUGG_CHANNEL, P, fichier }) {
const STORE_PATH   = dataPath(fichier);
const COOLDOWN_MS  = 5 * 60 * 1000; // une proposition toutes les 5 min par joueur

// { next, panelMsgId, items: { n: { userId, titre, texte, lien, msgId, status, createdAt, decidedBy, commentaire } } }
let store = { next: 1, panelMsgId: null, items: {} };
const derniere = new Map(); // userId -> date de la dernière proposition

function load() {
  try { store = { next: 1, panelMsgId: null, items: {}, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
}
function save() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {}
}

function estAdmin(interaction) {
  return !!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function autoClean(interaction, delay = 5000) {
  setTimeout(() => interaction.deleteReply().catch(() => {}), delay);
}

async function salon(client) {
  return client.channels.cache.get(SUGG_CHANNEL) || await client.channels.fetch(SUGG_CHANNEL).catch(() => null);
}

// ── Panneau du règlement (toujours remis en bas du salon) ─────────────────────
function panelPayload() {
  if (JEU) return panneau({
    embeds: [{
      title: '💡  PROPOSITIONS POUR LE JEU · GAME SUGGESTIONS',
      description: [
        '🇫🇷 **Français**',
        'Une idée pour améliorer le jeu ? Clique sur **Faire une proposition** et sois le plus précis possible :',
        '> • Un **titre** clair et une **catégorie** (gameplay, économie, interface, équilibrage…).',
        '> • Une **description détaillée** : ce que tu proposes et comment cela fonctionnerait.',
        '> • L\'**intérêt pour le jeu** : quel problème cela résout ou ce que cela apporte.',
        '> • Des **exemples**, références ou liens (facultatif).',
        '> • Un texte **soigné**, en français ou en anglais correct. Une proposition vague ou bâclée sera refusée.',
        '',
        '🇬🇧 **English**',
        'Got an idea to improve the game? Click **Make a suggestion** and be as precise as possible:',
        '> • A clear **title** and a **category** (gameplay, economy, interface, balance…).',
        '> • A **detailed description**: what you suggest and how it would work.',
        '> • The **benefit for the game**: the problem it solves or what it adds.',
        '> • **Examples**, references or links (optional).',
        '> • Well-written text, in correct French or English. Vague or careless suggestions will be declined.',
        '',
        '📩 Le staff valide ou refuse, tu reçois la décision en MP · The staff accepts or declines, you get the decision by DM.',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(P + '_new').setLabel('💡 Faire une proposition · Make a suggestion').setStyle(ButtonStyle.Primary),
    )],
  });
  return panneau({
    embeds: [{
      title: '🛠️  RÈGLEMENT DES MODS',
      description: [
        '💡 **PROPOSER UN MOD**',
        '',
        'Le mod proposé doit :',
        '> • Apporter une **réelle utilité** au serveur.',
        '> • Être **cohérent** avec l\'expérience de jeu.',
        '> • Être **adapté à la carte**.',
        '> • Ne **pas intégrer de mécanique autoload**.',
        '',
        '🚫 Aucun mod de **gestion automatique** dénaturant le gameplay.',
        '',
        'Clique sur **Faire une proposition**, présente le mod et ajoute son lien',
        '(facultatif). Le staff la valide ou la refuse, tu reçois la décision en MP.',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(P + '_new').setLabel('💡 Faire une proposition').setStyle(ButtonStyle.Primary),
    )],
  });
}

// Le HUB reste en tête du salon, les propositions en attente en dessous.
// Déjà en place : on le met juste à jour. Sinon (absent, ou une proposition plus
// ancienne que lui) : on reposte le HUB puis les propositions en attente.
async function installerHub(channel) {
  const hub = store.panelMsgId && await channel.messages.fetch(store.panelMsgId).catch(() => null);
  const enAttente = Object.entries(store.items).filter(([, s]) => s.status === 'attente');
  const enTete = hub && enAttente.every(([, s]) => !s.msgId || BigInt(s.msgId) > BigInt(hub.id));
  if (enTete) { await hub.edit(panelPayload()).catch(() => {}); return; }

  if (hub) await hub.delete().catch(() => {});
  for (const [, s] of enAttente) {
    const ancien = s.msgId && await channel.messages.fetch(s.msgId).catch(() => null);
    if (ancien) await ancien.delete().catch(() => {});
  }
  const msg = await channel.send(panelPayload()).catch(err => { console.error('⚠️ Suggestions :', err.message); return null; });
  store.panelMsgId = msg?.id || null;
  for (const [n, s] of enAttente) {
    const m = await channel.send(suggPayload(n, s)).catch(() => null);
    s.msgId = m?.id || null;
  }
  save();
}

// ── Message d'une proposition ─────────────────────────────────────────────────
const STATUTS = {
  attente: { label: '⏳ En attente de décision du staff', color: 0x5865F2 },
  valide:  { label: '✅ Proposition validée', color: 0x2ECC71 },
  refuse:  { label: '❌ Proposition refusée', color: 0xE74C3C },
};

function suggPayload(n, s) {
  const st = STATUTS[s.status];
  const fields = [];
  if (s.categorie) fields.push({ name: '🏷️ Catégorie · Category', value: s.categorie, inline: true });
  if (s.pourquoi) fields.push({ name: '🎯 Intérêt pour le jeu · Benefit', value: s.pourquoi.slice(0, 1024) });
  if (s.lien) fields.push({ name: JEU ? '🔗 Exemples / liens · Examples / links' : '🔗 Lien', value: s.lien });
  let statut = st.label;
  if (s.decidedBy) statut += ' par <@' + s.decidedBy + '>';
  fields.push({ name: '📌 Statut', value: statut });
  if (s.commentaire) fields.push({ name: '💬 Réponse du staff', value: s.commentaire.slice(0, 1024) });

  return {
    content: '',
    ...panneau({ embeds: [{
      title: (JEU ? '💡 Proposition n°' : '🛠️ Mod proposé n°') + n + ' · ' + s.titre,
      description: 'Proposée par <@' + s.userId + '>\n\n' + s.texte,
      fields,
      color: st.color,
      timestamp: new Date(s.createdAt).toISOString(),
    }] }),
    components: s.status === 'attente' ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(P + '_ok_' + n).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(P + '_no_' + n).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )] : [],
    allowedMentions: { parse: [] },
  };
}

// ── Bouton « Faire une proposition » ──────────────────────────────────────────
async function handleSuggNew(interaction) {
  const last = derniere.get(interaction.user.id) || 0;
  const reste = COOLDOWN_MS - (Date.now() - last);
  if (reste > 0) {
    await interaction.reply({ content: '⏳ Attends encore ' + Math.ceil(reste / 60000) + ' min avant une nouvelle proposition.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const modal = new ModalBuilder().setCustomId(P + '_modal').setTitle(JEU ? 'Proposition · Suggestion' : 'Proposer un mod');
  const champ = (id, label, style, o = {}) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(o.requis ?? true)
      .setMaxLength(o.max).setMinLength(o.min || 0).setPlaceholder(o.ph || ' '));
  if (JEU) modal.addComponents(
    champ('titre', 'Titre · Title', TextInputStyle.Short, { max: 80, ph: 'Ex : Système de métiers · Job system' }),
    champ('categorie', 'Catégorie · Category', TextInputStyle.Short, { max: 40, ph: 'Gameplay, économie, interface… · Gameplay, economy…' }),
    champ('texte', 'Description détaillée · Detailed description', TextInputStyle.Paragraph, { min: 50, max: 1500, ph: 'Que proposes-tu, comment ça fonctionnerait ? · What do you suggest, how would it work?' }),
    champ('pourquoi', 'Intérêt pour le jeu · Benefit for the game', TextInputStyle.Paragraph, { min: 20, max: 800, ph: 'Quel problème cela résout ? · What problem does it solve?' }),
    champ('lien', 'Exemples ou liens · Examples or links', TextInputStyle.Short, { requis: false, max: 300, ph: 'https://... (facultatif · optional)' }),
  );
  else modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('titre').setLabel('Nom du mod').setStyle(TextInputStyle.Short)
        .setMaxLength(80).setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('texte').setLabel('Ce qu\'il apporte au serveur').setStyle(TextInputStyle.Paragraph)
        .setMinLength(20).setMaxLength(1500).setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('lien').setLabel('Lien du mod (facultatif)').setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...').setMaxLength(300).setRequired(false),
    ),
  );
  await interaction.showModal(modal);
}

async function handleSuggModal(interaction) {
  const titre = interaction.fields.getTextInputValue('titre').trim();
  const texte = interaction.fields.getTextInputValue('texte').trim();
  const lien  = (interaction.fields.getTextInputValue('lien') || '').trim();
  const categorie = JEU ? interaction.fields.getTextInputValue('categorie').trim() : null;
  const pourquoi  = JEU ? interaction.fields.getTextInputValue('pourquoi').trim() : null;

  if (!titre || !texte) { await interaction.reply({ content: '❌ Le titre et la proposition sont obligatoires.', flags: 64 }); autoClean(interaction); return; }
  if (lien && !/^https?:\/\/\S+$/i.test(lien)) {
    await interaction.reply({ content: '❌ Le lien doit commencer par `http://` ou `https://`.', flags: 64 });
    autoClean(interaction, 8000);
    return;
  }

  const channel = await salon(interaction.client);
  if (!channel) { await interaction.reply({ content: '⚠️ Salon des suggestions introuvable.', flags: 64 }); autoClean(interaction); return; }

  const n = store.next++;
  const s = { userId: interaction.user.id, titre, texte, categorie, pourquoi, lien: lien || null, status: 'attente', createdAt: Date.now() };
  const msg = await channel.send(suggPayload(n, s)).catch(() => null);
  if (!msg) { store.next--; await interaction.reply({ content: '⚠️ Impossible de publier la proposition.', flags: 64 }); autoClean(interaction); return; }

  s.msgId = msg.id;
  store.items[n] = s;
  save();
  derniere.set(interaction.user.id, Date.now());

  await interaction.reply({ content: '✅ Ta proposition ' + (JEU ? '' : 'de mod ') + 'n°' + n + ' est publiée · Your suggestion #' + n + ' is posted. Tu recevras la décision du staff en MP · You will get the decision by DM.', flags: 64 });
  autoClean(interaction, 8000);
  await agrilog(interaction.guild, (JEU ? '💡 <@' + s.userId + '> propose **' : '🛠️ <@' + s.userId + '> propose le mod **') + titre + '** (n°' + n + ')');
}

// ── Décision admin : bouton puis modale (commentaire facultatif) ──────────────
async function handleSuggDecision(interaction) {
  const [, action, num] = interaction.customId.split('_');
  const s = store.items[num];
  if (!estAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  if (!s || s.status !== 'attente') { await interaction.reply({ content: 'ℹ️ Cette proposition a déjà été traitée.', flags: 64 }); autoClean(interaction); return; }

  const valide = action === 'ok';
  const modal = new ModalBuilder().setCustomId(P + '_' + action + 'modal_' + num)
    .setTitle((valide ? 'Valider' : 'Refuser') + ' la proposition n°' + num);
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('commentaire').setLabel(valide ? 'Message pour le joueur (facultatif)' : 'Raison du refus (facultatif)')
      .setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false),
  ));
  await interaction.showModal(modal);
}

async function handleSuggDecisionModal(interaction) {
  const m = interaction.customId.match(new RegExp('^' + P + '_(ok|no)modal_(\\d+)$'));
  const num = m[2];
  const valide = m[1] === 'ok';
  const s = store.items[num];
  if (!estAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  if (!s || s.status !== 'attente') { await interaction.reply({ content: 'ℹ️ Cette proposition a déjà été traitée.', flags: 64 }); autoClean(interaction); return; }

  s.status = valide ? 'valide' : 'refuse';
  s.decidedBy = interaction.user.id;
  s.decidedAt = Date.now();
  s.commentaire = (interaction.fields.getTextInputValue('commentaire') || '').trim() || null;
  save();

  // Une fois traitée, la proposition disparaît du salon (la décision part en MP et dans les logs)
  await interaction.reply({ content: (valide ? '✅ Proposition n°' + num + ' validée.' : '❌ Proposition n°' + num + ' refusée.') + ' Le joueur est prévenu en MP.', flags: 64 });
  autoClean(interaction);
  const channel = await salon(interaction.client);
  const msg = interaction.message || (channel && s.msgId && await channel.messages.fetch(s.msgId).catch(() => null));
  if (msg) await msg.delete().catch(() => {});

  let mp = true;
  try {
    const user = await interaction.client.users.fetch(s.userId);
    await user.send(panneau({ embeds: [{
      title: JEU ? (valide ? '✅ Ta proposition a été validée · Suggestion accepted' : '❌ Ta proposition a été refusée · Suggestion declined')
        : (valide ? '✅ Ton mod proposé a été validé' : '❌ Ton mod proposé a été refusé'),
      description: [
        '**' + s.titre + '** (n°' + num + ')',
        '',
        JEU
          ? (valide ? 'Merci pour ta proposition ! Le staff l\'a **validée**. · Thanks! The staff **accepted** it.'
                    : 'Le staff a étudié ta proposition mais l\'a **refusée**. · The staff reviewed it but **declined** it.')
          : valide
            ? 'Merci pour ta proposition ! Le staff a **validé** ce mod.'
            : 'Le staff a étudié ce mod mais l\'a **refusé**.',
        ...(s.commentaire ? ['', '💬 **Réponse du staff :**', s.commentaire] : []),
      ].join('\n'),
      color: valide ? 0x2ECC71 : 0xE74C3C,
      footer: { text: 'MonCopainBot' },
    }] }));
  } catch { mp = false; /* MP fermés */ }

  // Mod refusé : le motif est aussi affiché dans le salon des mods
  if (!valide && !JEU) {
    const fs25 = interaction.client.channels.cache.get(ids('MODS_CHANNEL_ID'));
    await fs25?.send({ ...panneau({ embeds: [{
      title: '❌ Mod refusé · ' + s.titre,
      description: 'Proposé par <@' + s.userId + '> · refusé par <@' + s.decidedBy + '>',
      fields: [{ name: '💬 Raison du refus', value: s.commentaire || 'Non précisé' }],
      color: 0xE74C3C,
    }] }), allowedMentions: { parse: [] } }).catch(console.error);
  }

  await agrilog(interaction.guild, (valide ? '✅' : '❌') + ' Proposition n°' + num + ' ' + (valide ? 'validée' : 'refusée')
    + ' par <@' + s.decidedBy + '> · auteur <@' + s.userId + '>' + (mp ? '' : ' (MP fermés)'));
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startSuggestions(client) {
  load();
  try {
    const channel = await salon(client);
    if (!channel) { console.error('⚠️ Suggestions : salon ' + SUGG_CHANNEL + ' introuvable'); return; }
    await installerHub(channel);
    const enAttente = Object.values(store.items).filter(s => s.status === 'attente').length;
    console.log((JEU ? '💡 Propositions du jeu' : '🛠️ Propositions de mods') + ' · prêt (' + enAttente + ' proposition(s) en attente)');
  } catch (err) {
    console.error('⚠️ Suggestions :', err.message);
  }
}

// Suppression définitive (dashboard) : message du salon + enregistrement, pour qu'elle ne soit pas republiée au redémarrage
async function supprimer(client, num) {
  const s = store.items[num];
  if (!s) throw new Error('Proposition introuvable');
  const channel = s.msgId && await salon(client);
  const msg = channel && await channel.messages.fetch(s.msgId).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
  delete store.items[num];
  save();
}

return { supprimer, startSuggestions, handleSuggNew, handleSuggModal, handleSuggDecision, handleSuggDecisionModal };
}

const jeu  = creer({ JEU: true, SUGG_CHANNEL: ids('SUGG_CHANNEL_ID'), P: 'sugg', fichier: 'suggestions.json' });
const mods = creer({ JEU: false, SUGG_CHANNEL: ids('MODS_CHANNEL_ID'), P: 'modprop', fichier: 'mods-propositions.json' });

// Le HUB des mods n'est publié que si MODS_CHANNEL_ID est défini
const startSuggestions = async client => { await jeu.startSuggestions(client); if (ids('MODS_CHANNEL_ID')) await mods.startSuggestions(client); };

module.exports = { startSuggestions, jeu, mods };
