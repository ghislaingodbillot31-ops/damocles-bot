/**
 * Succès FS25 — calcul des paliers, annonces et commande /succes
 * ---------------------------------------------------------------
 * Appelé automatiquement par fs25Bridge.js à chaque lecture du serveur.
 *
 * Pas besoin de base de données : les compteurs sont gardés par le mod
 * dans la partie. Au démarrage du bot, les succès déjà atteints sont
 * enregistrés en silence (pas de spam d'annonces à chaque redéploiement),
 * puis seuls les nouveaux paliers sont annoncés.
 */

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const SERIES = require('./fs25-succes-config');

// Médaille selon l'avancement dans la série (début -> fin)
const TIER_EMOJIS = ['🥉', '🥈', '🥇', '🏅', '🎖️', '🏆', '👑', '💎', '🌟'];
const BAR_LENGTH = 8;

let baselineDone = false;
const reached = new Map(); // farmId -> Map(seriesId -> nombre de paliers atteints)
let lastStatus = null;
let statsLogged = false;

// ---------- Valeurs ----------

/**
 * Valeur actuelle d'une série pour une ferme, ou null si la donnée n'existe pas dans le jeu.
 * Sources possibles (voir fs25AchievementsConfig.js) :
 *   stat: 'nom' | ['nom1', 'nom2']   statistique(s) de ferme (additionnées)
 *   statPrefix: 'breed'              toutes les stats qui commencent par ce préfixe
 *   produced: ['MILK', ...]          production animale / ruches
 *   moneyIn: ['SOLD_ANIMALS'] | '*'  € gagnés par type
 *   moneyOut: ['PURCHASE_FUEL'] | '*' € dépensés par type
 *   scale: 1/60                      facteur appliqué (ex. minutes -> heures)
 */
function seriesValue(series, farmId, status) {
  const src = series.source;
  const scale = series.scale ?? 1;
  const farmStats = status.stats.filter((x) => x.farm === farmId);

  if (src.stat || src.statPrefix) {
    const names = src.stat ? [].concat(src.stat) : null;
    const matching = farmStats.filter((x) => (names ? names.includes(x.name) : x.name.startsWith(src.statPrefix)));
    if (!matching.length) {
      // Possessions : absentes = 0 ; autres stats : absentes = inconnues du jeu
      const isOwned = names && names.every((n) => n.startsWith('_owned'));
      return isOwned ? 0 : null;
    }
    return matching.reduce((sum, x) => sum + x.value, 0) * scale;
  }

  let kind;
  let keys;
  if (src.produced) { kind = 'produced'; keys = src.produced; }
  else if (src.moneyIn) { kind = 'money_in'; keys = src.moneyIn; }
  else if (src.moneyOut) { kind = 'money_out'; keys = src.moneyOut; }
  else return null;

  return status.counters
    .filter((c) => c.kind === kind && c.farm === farmId && (keys === '*' || keys.includes(c.fillType)))
    .reduce((sum, c) => sum + c.value, 0) * scale;
}

const tiersReached = (series, value) => series.tiers.filter((t) => value >= t).length;

function fmt(n) {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return rounded.toLocaleString('fr-FR').replace(/ | /g, ' ');
}

const tierEmoji = (index, total) => TIER_EMOJIS[Math.min(TIER_EMOJIS.length - 1, Math.floor(((index + 1) / total) * TIER_EMOJIS.length - 1e-9))];

function bar(value, from, to) {
  const ratio = Math.max(0, Math.min(1, (value - from) / (to - from)));
  const full = Math.round(ratio * BAR_LENGTH);
  return '▰'.repeat(full) + '▱'.repeat(BAR_LENGTH - full);
}

// ---------- Détection des nouveaux succès ----------

/**
 * @returns {Array<{farm, series, tierIndex, value}>} succès nouvellement débloqués
 */
function computeUnlocks(status) {
  const unlocks = [];
  for (const farm of status.farms) {
    const isNewFarm = !reached.has(farm.id);
    const farmMap = reached.get(farm.id) || new Map();
    reached.set(farm.id, farmMap);

    for (const series of SERIES) {
      const value = seriesValue(series, farm.id, status);
      if (value === null) continue;
      const count = tiersReached(series, value);
      const before = farmMap.get(series.id) ?? 0;
      if (count > before && baselineDone && !isNewFarm) {
        unlocks.push({ farm, series, tierIndex: count - 1, value }); // seul le plus haut palier atteint
      }
      if (count > before || !farmMap.has(series.id)) farmMap.set(series.id, count);
    }
  }
  baselineDone = true;
  return unlocks;
}

// Une ligne par succès (même format que les logs) : ferme, série, niveau, prochain palier.
function unlockLine({ farm, series, tierIndex, value }, done = false) {
  const n = series.tiers.length;
  const next = series.tiers[tierIndex + 1];
  const medal = tierEmoji(tierIndex, n);
  return `${done ? medal : '🏆'} **${farm.name}** ${done ? '·' : 'a débloqué'} ${series.emoji} **${series.name}**  ·  niv. ${tierIndex + 1}/${n}${done ? '' : ' ' + medal} (${fmt(value)} ${series.unit})  ·  ${next ? 'prochain : ' + fmt(next) + ' ' + series.unit : 'série terminée ✅'}`;
}

// Envoie des lignes en messages de 2000 caractères max.
async function sendLines(channel, lines) {
  let buf = '';
  for (const l of lines) {
    if (buf && buf.length + l.length + 1 > 2000) { await channel.send({ content: buf, allowedMentions: { parse: [] } }); buf = ''; }
    buf += (buf ? '\n' : '') + l;
  }
  if (buf) await channel.send({ content: buf, allowedMentions: { parse: [] } });
}

/**
 * Appelé par fs25Bridge à chaque lecture réussie.
 */
const CHECK_EVERY_MS = 15 * 60 * 1000; // vérification des succès toutes les 15 min
let lastCheck = 0;

async function processAchievements(status, channel) {
  lastStatus = status; // /succes lit toujours les dernières données
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  if (!statsLogged && status.stats.length) {
    const names = [...new Set(status.stats.map((s) => s.name))].sort();
    console.log(`[FS25] Stats disponibles dans le jeu : ${names.join(', ')}`);
    const missing = SERIES.flatMap((s) => (s.source.stat ? [].concat(s.source.stat) : [])).filter((n) => !n.startsWith('_owned') && !names.includes(n));
    if (missing.length) console.log(`[FS25] Stats configurées mais absentes du jeu (ignorées) : ${missing.join(', ')}`);
    statsLogged = true;
  }

  const unlocks = computeUnlocks(status);
  if (unlocks.length && channel) {
    await sendLines(channel, unlocks.map((u) => unlockLine(u))).catch((e) => console.warn(`[FS25] Annonce succès impossible : ${e.message}`));
  }
  await require('./fs25-succes-hub').update(status, channel, unlocks).catch((e) => console.warn(`[FS25] Hub succès : ${e.message}`));
}

// ---------- Commande /succes ----------

function progressEmbed(farm, status) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 Succès — ${farm.name}`)
    .setColor(0xf1c40f)
    .setTimestamp(new Date());

  let total = 0;
  let done = 0;
  const byCategory = new Map();

  for (const series of SERIES) {
    const value = seriesValue(series, farm.id, status);
    if (value === null) continue;
    const count = tiersReached(series, value);
    total += series.tiers.length;
    done += count;

    let line;
    if (count >= series.tiers.length) {
      line = `${tierEmoji(count - 1, series.tiers.length)} ${series.emoji} **${series.name}** — ${fmt(value)} ${series.unit} ✅ terminé`;
    } else {
      const from = count ? series.tiers[count - 1] : 0;
      const next = series.tiers[count];
      line = `${count ? tierEmoji(count - 1, series.tiers.length) : '▫️'} ${series.emoji} **${series.name}** `
        + `niv. ${count}/${series.tiers.length} ${bar(value, from, next)} `
        + `${fmt(value)} / ${fmt(next)} ${series.unit}`;
    }
    if (!byCategory.has(series.category)) byCategory.set(series.category, []);
    byCategory.get(series.category).push(line);
  }

  for (const [category, lines] of byCategory) {
    // un champ Discord = 1024 caractères max -> on découpe si besoin
    let chunk = [];
    let part = 0;
    const flush = () => {
      if (!chunk.length) return;
      embed.addFields({ name: part ? `${category} (suite)` : category, value: chunk.join('\n') });
      chunk = [];
      part += 1;
    };
    for (const line of lines) {
      if ([...chunk, line].join('\n').length > 1024) flush();
      chunk.push(line);
    }
    flush();
  }

  embed.setDescription(total ? `**${done} / ${total}** niveaux débloqués` : '_Aucune statistique disponible pour le moment._');
  return embed;
}

const succesCommand = {
  data: new SlashCommandBuilder()
    .setName('succes')
    .setDescription('Affiche les succès Farming Simulator d\'une ferme')
    .addStringOption((o) => o.setName('ferme').setDescription('Nom de la ferme (par défaut : toutes)').setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const farms = lastStatus ? lastStatus.farms : [];
    await interaction.respond(farms
      .filter((f) => f.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((f) => ({ name: f.name, value: f.name })));
  },

  async execute(interaction) {
    if (!lastStatus) {
      await interaction.reply({ content: '⏳ Pas encore de données du serveur FS25, réessaie dans une minute.', flags: 64 });
      return;
    }
    const wanted = interaction.options.getString('ferme');
    const farms = wanted
      ? lastStatus.farms.filter((f) => f.name.toLowerCase() === wanted.toLowerCase())
      : lastStatus.farms;
    if (!farms.length) {
      await interaction.reply({ content: `❌ Ferme « ${wanted} » introuvable.`, flags: 64 });
      return;
    }
    await interaction.reply({ embeds: farms.slice(0, 10).map((f) => progressEmbed(f, lastStatus)) });
  },
};

// Recalcule tout depuis les stats actuelles et poste les succès déjà réalisés, une ligne chacun (rattrapage manuel, admin).
async function recapAll(channel) {
  if (!lastStatus) return 0;
  computeUnlocks(lastStatus); // met à jour la mémoire des paliers sans annoncer
  const lines = [];
  for (const farm of lastStatus.farms) {
    for (const series of SERIES) {
      const value = seriesValue(series, farm.id, lastStatus);
      const count = value === null ? 0 : tiersReached(series, value);
      if (count) lines.push(unlockLine({ farm, series, tierIndex: count - 1, value }, true));
    }
  }
  await sendLines(channel, lines);
  return lastStatus.farms.length;
}

// Chaque matin : vide le salon, republie le HUB puis le bilan des succès.
async function resetSalon(channel, avecSucces = false) {
  if (!lastStatus || !channel) return;
  for (;;) { // bulkDelete ignore les messages > 14 j : on les supprime un par un
    const msgs = await channel.messages.fetch({ limit: 100 });
    if (!msgs.size) break;
    const del = await channel.bulkDelete(msgs, true);
    for (const m of msgs.values()) if (!del.has(m.id)) await m.delete().catch(() => {});
  }
  await require('./fs25-succes-hub').update(lastStatus, channel);
  if (avecSucces) await recapAll(channel);
}

module.exports = { resetSalon, getStatus: () => lastStatus, seriesValue, tiersReached, recapAll, unlockLine, processAchievements, succesCommand, computeUnlocks, progressEmbed, _reset: () => { lastCheck = 0; baselineDone = false; reached.clear(); } };
