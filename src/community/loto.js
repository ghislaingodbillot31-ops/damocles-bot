const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { panneau } = require('../core/embed-format');
const { dataPath } = require('../core/paths');
const { publier } = require('../farm/panneau-sync');

// Mini-jeu « Euro-Copains » : 5 numéros (1-25) + 2 bonus (1-8), 1 grille par joueur et par tirage,
// tirage le mercredi et le samedi à 20h (Paris). Gains en points (XP du bot).
const CHANNEL_ID = process.env.LOTO_CHANNEL_ID || '1571825861626302536';
const MISE = 10, NB = 25, NS = 8, POT_BASE = 5000, POT_PLUS = 1000;
// GAINS[bons numéros][bons bonus] ; le 5+2 = jackpot (cagnotte)
const GAINS = { 5: [1500, 3000], 4: [150, 300, 800], 3: [30, 60, 150], 2: [0, 10, 30] };

const STORE_PATH = dataPath('loto.json');
// { panelMsgId, pot, tirage, tickets: { userId: { n: [], s: [] } }, dernier: { n, s, gagnants: [..] } }
let store = { panelMsgId: null, pot: POT_BASE, tirage: 1, tickets: {}, dernier: null };
try { store = { ...store, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const brouillons = new Map(); // grilles en cours de saisie (mémoire seulement)
const fmt = n => n.toLocaleString('fr-FR');
const tri = a => [...a].sort((x, y) => x - y);

// Prochain tirage : premier mercredi/samedi 20h Paris (on avance heure par heure, gère l'heure d'été)
function prochainTirage() {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
  let t = Math.ceil((Date.now() + 1) / 3600_000) * 3600_000;
  for (let i = 0; i < 24 * 8; i++, t += 3600_000) {
    const p = Object.fromEntries(f.formatToParts(t).map(x => [x.type, x.value]));
    if (p.hour === '20' && (p.weekday === 'Wed' || p.weekday === 'Sat')) return Math.floor(t / 1000);
  }
}

function panelPayload() {
  const joueurs = Object.keys(store.tickets).length, d = store.dernier;
  return panneau({
    embeds: [{
      title: '🎟️  EURO-COPAINS · TIRAGE N°' + store.tirage,
      description: [
        'Choisis **5 numéros (1-' + NB + ')** et **2 bonus (1-' + NS + ')**. **Une grille par joueur et par tirage**, mise : **'+MISE+' points**.',
        'Tirages : **mercredi et samedi à 20h** (Paris). Les gains sont versés en points de classement.',
        '',
        '💰 **Cagnotte (5 numéros + 2 bonus)** : ' + fmt(store.pot) + ' points',
        '⏰ **Prochain tirage** : <t:' + prochainTirage() + ':F> (<t:' + prochainTirage() + ':R>)',
        '👥 **Grilles jouées** : ' + joueurs,
        d ? '\n🏁 **Dernier tirage** : ' + d.n.join(' · ') + '  ⭐ ' + d.s.join(' · ') + '\n' + (d.gagnants.length ? d.gagnants.join('\n') : 'Aucun gagnant.') : '',
        '',
        '**Gains** · 5+2 : cagnotte · 5+1 : 3 000 · 5 : 1 500 · 4+2 : 800 · 4+1 : 300 · 4 : 150 · 3+2 : 150 · 3+1 : 60 · 3 : 30 · 2+2 : 30 · 2+1 : 10',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('loto_jouer').setLabel('🎟️ Jouer ma grille').setStyle(ButtonStyle.Success),
    )],
  });
}

async function majPanneau(client) {
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!ch) return null;
  store.panelMsgId = (await publier(ch, store.panelMsgId, panelPayload(), null, 'Euro-Copains')).id;
  save();
  return ch;
}

// Formulaire de grille (message visible par le joueur seul)
function grilleUI(b) {
  const menu = (id, nom, max, total) => new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(nom)
    .setMinValues(max).setMaxValues(max)
    .addOptions(Array.from({ length: total }, (_, i) => ({ label: String(i + 1), value: String(i + 1), default: b[id === 'loto_n' ? 'n' : 's'].includes(i + 1) })));
  return {
    content: '🎟️ **Ta grille** — 5 numéros, puis 2 bonus, puis valide.\nNuméros : ' + (b.n.length ? tri(b.n).join(' · ') : '—') + '\nBonus : ' + (b.s.length ? tri(b.s).join(' · ') : '—'),
    components: [
      new ActionRowBuilder().addComponents(menu('loto_n', '5 numéros (1-' + NB + ')', 5, NB)),
      new ActionRowBuilder().addComponents(menu('loto_s', '2 bonus (1-' + NS + ')', 2, NS)),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('loto_ok').setLabel('✅ Valider (−10 pts, définitif)').setStyle(ButtonStyle.Success)
        .setDisabled(b.n.length !== 5 || b.s.length !== 2)),
    ],
  };
}

const ticketTxt = t => 'Ta grille : **' + tri(t.n).join(' · ') + '**  ⭐ **' + tri(t.s).join(' · ') + '**';

async function handleButton(i) {
  if (i.channelId !== CHANNEL_ID) return;
  if (i.customId === 'loto_jouer') {
    const t = store.tickets[i.user.id];
    if (t) return i.reply({ content: '🎟️ Tu as déjà joué pour ce tirage. ' + ticketTxt(t) + '\nRésultat : <t:' + prochainTirage() + ':F>', flags: 64 });
    const solde = require('./levels').getPoints(i.user.id);
    if (solde < MISE) return i.reply({ content: '❌ Il faut ' + MISE + ' points pour jouer (tu en as ' + fmt(solde) + ').', flags: 64 });
    const b = { n: [], s: [] };
    brouillons.set(i.user.id, b);
    return i.reply({ ...grilleUI(b), flags: 64 });
  }
  // loto_ok
  const b = brouillons.get(i.user.id);
  if (store.tickets[i.user.id] || !b || b.n.length !== 5 || b.s.length !== 2)
    return i.update({ content: '⚠️ Grille invalide ou déjà jouée.', components: [] });
  if (!require('./levels').retirerPoints(i.user.id, MISE).ok) return i.update({ content: '❌ Il faut ' + MISE + ' points pour jouer.', components: [] });
  store.tickets[i.user.id] = { n: tri(b.n), s: tri(b.s) };
  brouillons.delete(i.user.id);
  save();
  await i.update({ content: '✅ Grille enregistrée (−' + MISE + ' points) ! ' + ticketTxt(store.tickets[i.user.id]) + '\nBonne chance pour le tirage <t:' + prochainTirage() + ':R> 🍀', components: [] });
  majPanneau(i.client).catch(() => {});
}

async function handleSelect(i) {
  const b = brouillons.get(i.user.id) || { n: [], s: [] };
  b[i.customId === 'loto_n' ? 'n' : 's'] = i.values.map(Number);
  brouillons.set(i.user.id, b);
  await i.update(grilleUI(b));
}

const tirer = (max, k) => {
  const p = Array.from({ length: max }, (_, i) => i + 1), r = [];
  while (r.length < k) r.push(p.splice(require('crypto').randomInt(p.length), 1)[0]);
  return tri(r);
};

async function tirage(client) {
  const n = tirer(NB, 5), s = tirer(NS, 2), gagnants = [];
  const levels = require('./levels');
  let jackpot = false;
  for (const [uid, t] of Object.entries(store.tickets)) {
    const bn = t.n.filter(x => n.includes(x)).length, bs = t.s.filter(x => s.includes(x)).length;
    const gain = bn === 5 && bs === 2 ? store.pot : (GAINS[bn]?.[bs] || 0);
    if (!gain) continue;
    if (bn === 5 && bs === 2) jackpot = true;
    levels.adminAjuster(uid, gain);
    gagnants.push((jackpot && bn === 5 && bs === 2 ? '🏆 ' : '🎉 ') + '<@' + uid + '> · ' + bn + '+' + bs + ' · **' + fmt(gain) + '** points');
  }
  const joueurs = Object.keys(store.tickets).length;
  store.dernier = { n, s, gagnants };
  store.pot = jackpot ? POT_BASE : store.pot + POT_PLUS;
  store.tickets = {};
  const num = store.tirage++;
  save();
  const ch = await majPanneau(client);
  await ch?.send({
    embeds: [{
      title: '🎟️ RÉSULTAT · TIRAGE N°' + num,
      description: '**' + n.join(' · ') + '**  ⭐ **' + s.join(' · ') + '**\n\n' + joueurs + ' grille(s) jouée(s)\n' + (gagnants.length ? gagnants.join('\n') : 'Aucun gagnant cette fois.')
        + (jackpot ? '\n\n💥 **JACKPOT !**' : '\n\n💰 Cagnotte reportée : ' + fmt(store.pot) + ' points'),
      color: 0xF1C40F,
    }],
  }).catch(() => {});
}

function startLoto(client, cron) {
  cron.schedule('0 20 * * 3,6', () => tirage(client).catch(e => console.error('⚠️ Loto tirage :', e.message)), { timezone: 'Europe/Paris' });
  majPanneau(client).then(() => console.log('🎟️ Loto · prêt')).catch(e => console.error('⚠️ Loto :', e.message));
}

module.exports = { startLoto, handleButton, handleSelect, tirage };
