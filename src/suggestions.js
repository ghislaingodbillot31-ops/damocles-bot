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
const SUGG_CHANNEL = '1544351510689747074';
const STORE_PATH   = dataPath('suggestions.json');
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
      footer: { text: 'EUROAGRI · Damoclès Bot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sugg_new').setLabel('💡 Faire une proposition').setStyle(ButtonStyle.Primary),
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
  if (s.lien) fields.push({ name: '🔗 Lien', value: s.lien });
  let statut = st.label;
  if (s.decidedBy) statut += ' par <@' + s.decidedBy + '>';
  fields.push({ name: '📌 Statut', value: statut });
  if (s.commentaire) fields.push({ name: '💬 Réponse du staff', value: s.commentaire.slice(0, 1024) });

  return {
    content: '',
    ...panneau({ embeds: [{
      title: '🛠️ Mod proposé n°' + n + ' · ' + s.titre,
      description: 'Proposée par <@' + s.userId + '>\n\n' + s.texte,
      fields,
      color: st.color,
      timestamp: new Date(s.createdAt).toISOString(),
    }] }),
    components: s.status === 'attente' ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sugg_ok_' + n).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sugg_no_' + n).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
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
  const modal = new ModalBuilder().setCustomId('sugg_modal').setTitle('Proposer un mod');
  modal.addComponents(
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

  if (!titre || !texte) { await interaction.reply({ content: '❌ Le titre et la proposition sont obligatoires.', flags: 64 }); autoClean(interaction); return; }
  if (lien && !/^https?:\/\/\S+$/i.test(lien)) {
    await interaction.reply({ content: '❌ Le lien doit commencer par `http://` ou `https://`.', flags: 64 });
    autoClean(interaction, 8000);
    return;
  }

  const channel = await salon(interaction.client);
  if (!channel) { await interaction.reply({ content: '⚠️ Salon des suggestions introuvable.', flags: 64 }); autoClean(interaction); return; }

  const n = store.next++;
  const s = { userId: interaction.user.id, titre, texte, lien: lien || null, status: 'attente', createdAt: Date.now() };
  const msg = await channel.send(suggPayload(n, s)).catch(() => null);
  if (!msg) { store.next--; await interaction.reply({ content: '⚠️ Impossible de publier la proposition.', flags: 64 }); autoClean(interaction); return; }

  s.msgId = msg.id;
  store.items[n] = s;
  save();
  derniere.set(interaction.user.id, Date.now());

  await interaction.reply({ content: '✅ Ta proposition de mod n°' + n + ' est publiée. Tu recevras la décision du staff en MP.', flags: 64 });
  autoClean(interaction, 8000);
  await agrilog(interaction.guild, '🛠️ <@' + s.userId + '> propose le mod **' + titre + '** (n°' + n + ')');
}

// ── Décision admin : bouton puis modale (commentaire facultatif) ──────────────
async function handleSuggDecision(interaction) {
  const [, action, num] = interaction.customId.split('_');
  const s = store.items[num];
  if (!estAdmin(interaction)) { await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 }); autoClean(interaction); return; }
  if (!s || s.status !== 'attente') { await interaction.reply({ content: 'ℹ️ Cette proposition a déjà été traitée.', flags: 64 }); autoClean(interaction); return; }

  const valide = action === 'ok';
  const modal = new ModalBuilder().setCustomId('sugg_' + action + 'modal_' + num)
    .setTitle((valide ? 'Valider' : 'Refuser') + ' la proposition n°' + num);
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('commentaire').setLabel(valide ? 'Message pour le joueur (facultatif)' : 'Raison du refus (facultatif)')
      .setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false),
  ));
  await interaction.showModal(modal);
}

async function handleSuggDecisionModal(interaction) {
  const m = interaction.customId.match(/^sugg_(ok|no)modal_(\d+)$/);
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
      title: valide ? '✅ Ton mod proposé a été validé' : '❌ Ton mod proposé a été refusé',
      description: [
        '**' + s.titre + '** (n°' + num + ')',
        '',
        valide
          ? 'Merci pour ta proposition ! Le staff a **validé** ce mod.'
          : 'Le staff a étudié ce mod mais l\'a **refusé**.',
        ...(s.commentaire ? ['', '💬 **Réponse du staff :**', s.commentaire] : []),
      ].join('\n'),
      color: valide ? 0x2ECC71 : 0xE74C3C,
      footer: { text: 'EUROAGRI · Damoclès Bot' },
    }] }));
  } catch { mp = false; /* MP fermés */ }

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
    console.log('🛠️ Propositions de mods · prêt (' + enAttente + ' proposition(s) en attente)');
  } catch (err) {
    console.error('⚠️ Suggestions :', err.message);
  }
}

module.exports = { startSuggestions, handleSuggNew, handleSuggModal, handleSuggDecision, handleSuggDecisionModal };
