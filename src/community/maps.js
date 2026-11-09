const ids = require('../core/ids');
const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('../core/embed-format');
const { dataPath } = require('../core/paths');

// HUB des cartes : les joueurs proposent une carte (nom + lien), chacun la note de 1 à 5 (un vote par joueur,
// modifiable). Le salon contient : le panneau, le journal (classement à jour), puis une carte par proposition.
const STORE_PATH = dataPath('maps.json');
const MAPS_CHANNEL = ids('MAPS_CHANNEL_ID', '1569483843780739193');
const MEDAILLES = ['🥇', '🥈', '🥉'];

// { next, panelMsgId, journalMsgId, items: { n: { userId, nom, lien, msgId, votes: { userId: note }, createdAt } } }
let store = { next: 1, panelMsgId: null, journalMsgId: null, items: {} };

function load() {
  try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
}
function save() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {}
}
const salon = client => {
  const id = MAPS_CHANNEL;
  return client.channels.cache.get(id) || client.channels.fetch(id).catch(() => null);
};

function stats(s) {
  const notes = Object.values(s.votes || {});
  return { n: notes.length, moy: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0 };
}
const etoiles = moy => '⭐'.repeat(Math.round(moy)) || '—';

// ── Messages ──────────────────────────────────────────────────────────────────
function panelPayload() {
  return panneau({
    embeds: [{
      title: '🗺️  PROPOSER UNE CARTE',
      description: [
        'Une carte à faire découvrir ? Clique sur **Proposer une carte**, indique son **nom** et son **lien**.',
        '',
        'Chaque joueur peut ensuite la **noter de 1 à 5** avec les boutons sous la carte (ton vote reste modifiable).',
        'Le **classement** ci-dessous est mis à jour à chaque vote.',
      ].join('\n'),
      color: 0x3498DB,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('map_new').setLabel('🗺️ Proposer une carte').setStyle(ButtonStyle.Primary),
    )],
  });
}

function journalPayload() {
  const liste = Object.entries(store.items)
    .map(([n, s]) => ({ n, s, ...stats(s) }))
    .sort((a, b) => b.moy - a.moy || b.n - a.n);
  const lignes = liste.slice(0, 25).map((x, i) =>
    (MEDAILLES[i] || '`' + (i + 1) + '.`') + ' **' + x.s.nom + '** — ' +
    (x.n ? '**' + x.moy.toFixed(2) + '**/5 ' + etoiles(x.moy) + ' (' + x.n + ' vote' + (x.n > 1 ? 's' : '') + ')' : '_pas encore noté_'));
  return panneau({ embeds: [{
    title: '📜  JOURNAL DES CARTES · CLASSEMENT',
    description: lignes.length ? lignes.join('\n') : '_Aucune carte proposée pour le moment._',
    color: 0xF1C40F,
    footer: { text: liste.length + ' carte(s) · mis à jour automatiquement' },
    timestamp: new Date().toISOString(),
  }] });
}

function cartePayload(n, s) {
  const { n: nb, moy } = stats(s);
  return {
    content: '',
    ...panneau({ embeds: [{
      title: '🗺️ Carte n°' + n + ' · ' + s.nom,
      description: 'Proposée par <@' + s.userId + '>\n🔗 ' + s.lien,
      fields: [{ name: '⭐ Note', value: nb ? '**' + moy.toFixed(2) + '**/5 ' + etoiles(moy) + ' · ' + nb + ' vote' + (nb > 1 ? 's' : '') : '_pas encore noté_' }],
      color: 0x3498DB,
      timestamp: new Date(s.createdAt).toISOString(),
    }] }),
    components: [new ActionRowBuilder().addComponents(
      [1, 2, 3, 4, 5].map(i => new ButtonBuilder().setCustomId('maprate_' + n + '_' + i).setLabel(i + ' ⭐').setStyle(ButtonStyle.Secondary)),
    )],
    allowedMentions: { parse: [] },
  };
}

async function majJournal(channel) {
  const m = store.journalMsgId && await channel.messages.fetch(store.journalMsgId).catch(() => null);
  if (m) { await m.edit(journalPayload()).catch(() => {}); return; }
  store.journalMsgId = (await channel.send(journalPayload()).catch(() => null))?.id || null;
  save();
}

// ── Interactions ──────────────────────────────────────────────────────────────
async function handleNew(interaction) {
  const champ = (id, label, ph) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setMaxLength(id === 'nom' ? 80 : 300).setRequired(true).setPlaceholder(ph));
  await interaction.showModal(new ModalBuilder().setCustomId('map_modal').setTitle('Proposer une carte')
    .addComponents(champ('nom', 'Nom de la carte', 'Ex : Riverbend Springs'), champ('lien', 'Lien de la carte', 'https://...')));
}

async function handleModal(interaction) {
  const nom = interaction.fields.getTextInputValue('nom').trim();
  const lien = interaction.fields.getTextInputValue('lien').trim();
  const rep = c => interaction.reply({ content: c, flags: 64 }).then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), 6000));
  if (!/^https?:\/\/\S+$/i.test(lien)) return rep('❌ Le lien doit commencer par `http://` ou `https://`.');
  const channel = await salon(interaction.client);
  if (!channel) return rep('⚠️ Salon des cartes introuvable.');

  const n = store.next++;
  const s = { userId: interaction.user.id, nom, lien, votes: {}, createdAt: Date.now() };
  const msg = await channel.send(cartePayload(n, s)).catch(() => null);
  if (!msg) { store.next--; return rep('⚠️ Impossible de publier la carte.'); }
  s.msgId = msg.id;
  store.items[n] = s;
  save();
  await majJournal(channel);
  await rep('✅ Ta carte **' + nom + '** est publiée, les joueurs peuvent la noter.');
}

async function handleRate(interaction) {
  const [, n, note] = interaction.customId.split('_');
  const s = store.items[n];
  if (!s) return interaction.reply({ content: 'ℹ️ Cette carte n\'existe plus.', flags: 64 });
  if (s.userId === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas noter ta propre carte.', flags: 64 });
  s.votes[interaction.user.id] = Number(note);
  save();
  await interaction.update(cartePayload(n, s)); // met à jour la carte sur place
  await majJournal(interaction.channel);
}

// ── Démarrage : panneau + journal + cartes, dans cet ordre ────────────────────
async function startMaps(client) {
  if (!MAPS_CHANNEL) return;
  load();
  try {
    const channel = await salon(client);
    if (!channel) return console.error('⚠️ Cartes : salon introuvable');
    const ok = async id => id && await channel.messages.fetch(id).catch(() => null);
    const [panel, journal] = [await ok(store.panelMsgId), await ok(store.journalMsgId)];
    if (panel && journal) {
      await panel.edit(panelPayload()).catch(() => {});
      await journal.edit(journalPayload()).catch(() => {});
    } else {
      // Ordre cassé ou premier lancement : on reposte tout dans le bon ordre
      for (const id of [store.panelMsgId, store.journalMsgId, ...Object.values(store.items).map(s => s.msgId)])
        if (id) await channel.messages.delete(id).catch(() => {});
      store.panelMsgId = (await channel.send(panelPayload())).id;
      store.journalMsgId = (await channel.send(journalPayload())).id;
      for (const [n, s] of Object.entries(store.items)) s.msgId = (await channel.send(cartePayload(n, s)).catch(() => null))?.id || null;
      save();
    }
    console.log('🗺️ Cartes · prêt (' + Object.keys(store.items).length + ' carte(s))');
  } catch (err) { console.error('⚠️ Cartes :', err.message); }
}

module.exports = { startMaps, handleNew, handleModal, handleRate };
