const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { panneau } = require('../core/embed-format');
const ids = require('../core/ids');
const levels = require('./levels');

// Événements aléatoires dans le salon #événement : le premier qui clique sur le bouton gagne des points de classement (XP).
const CHANNEL_ID = ids('EVENT_CHANNEL_ID', '1564789708444401746');
const GAIN       = 200;
const DELAI_MIN  = 2 * 3600_000; // un événement toutes les 2 à 6 heures
const DELAI_MAX  = 6 * 3600_000;

const MESSAGES = [
  ['⚡ ÉCLAIR !', 'Un éclair traverse le serveur… le plus rapide l\'attrape !'],
  ['🎁 COLIS SURPRISE', 'Un colis vient d\'arriver ! Qui l\'ouvrira en premier ?'],
  ['🚜 TRACTEUR EN FOLIE', 'Un tracteur sans conducteur fonce vers toi… saute dessus avant les autres !'],
  ['🌾 RÉCOLTE EXPRESS', 'Les blés sont mûrs, mais pas pour longtemps. Le premier à récolter gagne !'],
  ['💰 TRÉSOR DANS LE CHAMP', 'Un trésor est enterré dans le champ ! Le premier arrivé le déterre.'],
];

const actif = new Set(); // messages d'événement encore ouverts (un redémarrage les referme)

const bouton = (off = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('event_clic').setLabel('Appuie vite !').setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(off));

const TYPES = { clic: lancerClic, chrono: lancerChrono, bingo: lancerBingo };
const lancer = (client, type) => (TYPES[type] || Object.values(TYPES)[Math.floor(Math.random() * 3)])(client);

// ── Chrono : arrêter un compteur au plus près d'une cible, ouvert 1 h ──
const CHRONO_DUREE = 3600_000;
const chronos = new Map(); // msgId → { cible, essais: Map(userId → { debut, ecart }) }
const chronoBtn = (cible, off = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('event_chrono_go').setLabel('Lancer le chrono · viser ' + cible + ' s').setEmoji('⏱️').setStyle(ButtonStyle.Primary).setDisabled(off));

async function lancerChrono(client) {
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!ch) return;
  const cible = 5 + Math.floor(Math.random() * 11); // 5 à 15 s
  const msg = await ch.send({
    ...panneau({ embeds: [{
      title: '⏱️ DÉFI CHRONO',
      description: 'Arrête le compteur **le plus près possible de ' + cible + ' secondes** !\n\n1️⃣ Clique sur **Lancer le chrono**\n2️⃣ Compte dans ta tête, puis clique sur **STOP**\n\n🏆 Le plus précis gagne **' + GAIN + ' points** · Une seule tentative · Fin <t:' + Math.floor((Date.now() + CHRONO_DUREE) / 1000) + ':R>',
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }] }),
    components: [chronoBtn(cible)],
  });
  chronos.set(msg.id, { cible, essais: new Map() });
  setTimeout(() => finChrono(msg).catch(err => console.error('⚠️ Chrono :', err.message)), CHRONO_DUREE);
}

async function finChrono(msg) {
  const c = chronos.get(msg.id);
  chronos.delete(msg.id);
  const classes = [...c.essais].filter(([, e]) => e.ecart != null).sort((a, b) => a[1].ecart - b[1].ecart);
  const fmt = e => (e.ecart / 1000).toFixed(2) + ' s d\'écart';
  let description = '⏱️ Cible : **' + c.cible + ' s**\n\n';
  if (classes.length) {
    levels.adminAjuster(classes[0][0], GAIN);
    description += '🏆 <@' + classes[0][0] + '> gagne **' + GAIN + ' points** (' + fmt(classes[0][1]) + ') !\n'
      + classes.slice(1, 3).map(([u, e], i) => (i ? '🥉' : '🥈') + ' <@' + u + '> · ' + fmt(e)).join('\n');
  } else description += 'Personne n\'a participé. 😴';
  await msg.edit({ embeds: [{ ...msg.embeds[0].toJSON(), color: 0x57F287, description }], components: [chronoBtn(c.cible, true)], allowedMentions: { users: [] } });
}

async function handleChrono(interaction) {
  const stop = interaction.customId.startsWith('event_chrono_stop_');
  const c = chronos.get(stop ? interaction.customId.slice(18) : interaction.message.id);
  const rep = content => interaction.reply({ content, flags: 64 });
  if (!c) return rep('⏳ Ce défi est terminé. · This challenge is over.');
  const uid = interaction.user.id;
  if (!stop) {
    if (c.essais.has(uid)) return rep('⛔ Tu as déjà tenté ta chance. · One attempt only.');
    const essai = { debut: 0, ecart: null };
    c.essais.set(uid, essai);
    await interaction.reply({
      content: '⏱️ **Chrono lancé !**\n🎯 Temps à viser : **' + c.cible + ' secondes**\nClique sur STOP quand tu penses y être.',
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('event_chrono_stop_' + interaction.message.id).setLabel('STOP à ' + c.cible + ' s').setEmoji('🛑').setStyle(ButtonStyle.Danger))],
      flags: 64,
    });
    essai.debut = Date.now(); // mesuré une fois le bouton STOP affiché
    return;
  }
  const t = Date.now();
  const essai = c.essais.get(uid);
  if (!essai || essai.ecart != null) return interaction.update({ content: '⛔ Chrono déjà arrêté.', components: [] });
  essai.ecart = Math.abs(t - essai.debut - c.cible * 1000);
  await interaction.update({ content: '🛑 Arrêté à **' + ((t - essai.debut) / 1000).toFixed(2) + ' s** (cible ' + c.cible + ' s) → **' + (essai.ecart / 1000).toFixed(2) + ' s** d\'écart. Résultat à la fin du défi !', components: [] });
}

// ── Bingo : 5 min d'inscription (5 numéros parmi 50), puis tirage ; le premier qui a ses 5 numéros appuie sur BINGO ──
const BINGO_ATTENTE = 5 * 60_000;
const BINGO_TIRAGE  = 5_000; // un numéro toutes les 5 s
const bingos = new Map();    // msgId → { msg, joueurs: Map(userId → [5 numéros]), tires: [], fini, essai: Map(userId → ts) }
const bingoRow = phase => new ActionRowBuilder().addComponents(phase === 'inscription'
  ? new ButtonBuilder().setCustomId('event_bingo_join').setLabel('M\'inscrire · choisir mes 5 numéros').setEmoji('🎟️').setStyle(ButtonStyle.Primary)
  : new ButtonBuilder().setCustomId('event_bingo_go').setLabel('BINGO !').setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(phase === 'fini'));
const bingoEmbed = (msg, description, color = 0x5865F2) => ({ ...msg.embeds[0].toJSON(), description, color });
const attente = ms => new Promise(r => setTimeout(r, ms));
const melange = () => [...Array(50).keys()].map(i => i + 1).sort(() => Math.random() - 0.5);

async function lancerBingo(client) {
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!ch) return;
  const msg = await ch.send({
    ...panneau({ embeds: [{
      title: '🎉 BINGO !',
      description: '🎟️ Inscris-toi et choisis **5 numéros entre 1 et 50** (ou laisse vide pour les avoir au hasard).\n\nLe tirage commence <t:' + Math.floor((Date.now() + BINGO_ATTENTE) / 1000) + ':R>.\nDes numéros vont tomber : le **premier** qui a ses 5 numéros appuie sur **BINGO** et gagne **' + GAIN + ' points** !',
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }] }),
    components: [bingoRow('inscription')],
  });
  const b = { msg, joueurs: new Map(), tires: [], fini: false, essai: new Map() };
  bingos.set(msg.id, b);
  await attente(BINGO_ATTENTE);
  await tirageBingo(b).catch(err => console.error('⚠️ Bingo :', err.message));
  bingos.delete(msg.id);
}

async function tirageBingo(b) {
  const { msg } = b;
  if (!b.joueurs.size) return msg.edit({ embeds: [bingoEmbed(msg, '😴 Personne ne s\'est inscrit : bingo annulé.', 0x99AAB5)], components: [bingoRow('fini')] });
  const pioche = melange();
  const texte = fin => '🎟️ **' + b.joueurs.size + '** joueur(s) en jeu · Appuie sur **BINGO** dès que tes 5 numéros sont tombés !\n\n'
    + (b.tires.length ? '🎱 Dernier numéro : **' + b.tires.at(-1) + '**\n📋 Déjà tombés : ' + b.tires.join(' · ') : '🎱 Le tirage commence…') + (fin || '');
  await msg.edit({ embeds: [bingoEmbed(msg, texte(), 0xFEE75C)], components: [bingoRow('jeu')] });
  while (!b.fini && pioche.length) {
    await attente(BINGO_TIRAGE);
    if (b.fini) break;
    b.tires.push(pioche.pop());
    await msg.edit({ embeds: [bingoEmbed(msg, texte(), 0xFEE75C)], components: [bingoRow('jeu')] }).catch(() => {});
  }
  if (!b.fini) await msg.edit({ embeds: [bingoEmbed(msg, texte('\n\n😴 Les 50 numéros sont tombés sans BINGO : personne ne gagne.'), 0x99AAB5)], components: [bingoRow('fini')] });
}

async function handleBingo(interaction) {
  const b = bingos.get(interaction.message.id);
  const rep = content => interaction.reply({ content, flags: 64 });
  if (!b) return rep('⏳ Ce bingo est terminé. · This bingo is over.');
  const uid = interaction.user.id;
  if (interaction.customId === 'event_bingo_join') {
    if (b.tires.length || b.fini) return rep('⛔ Le tirage a déjà commencé. · Draw already started.');
    const modal = new ModalBuilder().setCustomId('event_bingo_modal_' + b.msg.id).setTitle('Bingo · tes 5 numéros');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nums').setLabel('5 numéros de 1 à 50 (vide = au hasard)')
      .setStyle(TextInputStyle.Short).setPlaceholder('ex : 4 12 23 37 50').setMaxLength(40).setRequired(false)
      .setValue((b.joueurs.get(uid) || []).join(' '))));
    return interaction.showModal(modal);
  }
  // BINGO !
  const mes = b.joueurs.get(uid);
  if (!mes) return rep('⛔ Tu n\'es pas inscrit à ce bingo. · You are not registered.');
  if (b.fini) return rep('⏳ Trop tard, quelqu\'un a déjà gagné. · Too late.');
  if (Date.now() - (b.essai.get(uid) || 0) < 10_000) return rep('⏳ Patiente 10 s avant de réessayer. · Wait 10 s.');
  b.essai.set(uid, Date.now());
  if (!mes.every(n => b.tires.includes(n))) return rep('❌ Pas encore ! Il te manque : **' + mes.filter(n => !b.tires.includes(n)).join(', ') + '**');
  b.fini = true;
  levels.adminAjuster(uid, GAIN);
  await interaction.update({
    embeds: [bingoEmbed(b.msg, '🏆 <@' + uid + '> crie **BINGO** avec **' + mes.join(' · ') + '** et gagne **' + GAIN + ' points** de classement !\n\n📋 Numéros tombés : ' + b.tires.join(' · '), 0x57F287)],
    components: [bingoRow('fini')], allowedMentions: { users: [] },
  });
}

async function handleBingoModal(interaction) {
  const b = bingos.get(interaction.customId.slice(18));
  const rep = content => interaction.reply({ content, flags: 64 });
  if (!b || b.tires.length) return rep('⛔ Les inscriptions sont closes. · Registration closed.');
  const brut = interaction.fields.getTextInputValue('nums').trim();
  let nums;
  if (brut) {
    nums = [...new Set(brut.split(/[\s,;]+/).map(Number))];
    if (nums.length !== 5 || nums.some(n => !Number.isInteger(n) || n < 1 || n > 50))
      return rep('❌ Il faut **5 numéros différents** entre 1 et 50, séparés par des espaces. · Need 5 different numbers from 1 to 50.');
  } else nums = melange().slice(0, 5);
  nums.sort((x, y) => x - y);
  b.joueurs.set(interaction.user.id, nums);
  await rep('✅ Inscrit ! Tes numéros : **' + nums.join(' · ') + '**\nLe tirage commence à la fin du compte à rebours.');
}

async function lancerClic(client) {
  const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!ch) return;
  const [titre, texte] = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const msg = await ch.send({
    ...panneau({ embeds: [{
      title: titre,
      description: texte + '\n\n🏆 Le **premier** qui appuie gagne **' + GAIN + ' points** de classement !\nThe **first** to press wins **' + GAIN + ' points**!',
      color: 0xFEE75C,
      footer: { text: 'MonCopainBot' },
    }] }),
    components: [bouton()],
  });
  actif.add(msg.id);
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith('event_bingo')) return handleBingo(interaction);
  if (interaction.customId.startsWith('event_chrono')) return handleChrono(interaction);
  const id = interaction.message.id;
  if (!actif.delete(id)) { // déjà gagné (ou événement d'avant redémarrage)
    await interaction.update({ components: [bouton(true)] }).catch(() => {});
    return;
  }
  levels.adminAjuster(interaction.user.id, GAIN);
  const e = interaction.message.embeds[0].toJSON();
  await interaction.update({
    embeds: [{ ...e, color: 0x57F287, description: '🏆 <@' + interaction.user.id + '> a été le plus rapide et gagne **' + GAIN + ' points** de classement !' }],
    components: [bouton(true)],
    allowedMentions: { users: [] },
  });
}

function prochain(client) {
  const delai = DELAI_MIN + Math.random() * (DELAI_MAX - DELAI_MIN);
  setTimeout(() => { lancer(client).catch(err => console.error('⚠️ Événement :', err.message)).finally(() => prochain(client)); }, delai);
}

function startEvenements(client) {
  prochain(client);
  if (process.env.EVENT_NOW) lancer(client, process.env.EVENT_NOW).catch(err => console.error('⚠️ Événement :', err.message)); // test (EVENT_NOW=clic|chrono) : un événement dès le démarrage
  console.log('🎲 Événements · prêt');
}

module.exports = { startEvenements, handleButton, handleBingoModal, lancer };
