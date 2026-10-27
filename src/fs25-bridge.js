/**
 * Module FS25 -> Discord pour un bot Discord.js v14
 * ---------------------------------------------------
 * Lit le fichier status.xml écrit par le mod FS25_DiscordBridge
 * sur le serveur xREALM (FTP ou SFTP) et met à jour UN message
 * dans un salon Discord.
 *
 * Dépendances : npm install basic-ftp ssh2-sftp-client
 *
 * Variables d'environnement (Render > Environment) :
 *   FS25_STATUS_CHANNEL_ID ID du salon où afficher le statut      (obligatoire)
 *   FS25_SOURCE       "ftp" ou "sftp"                          (défaut : ftp)
 *   FS25_HOST         adresse du serveur xREALM               (obligatoire)
  *   FS25_FTP_PORT     21 (FTP) / 22 ou 2022 (SFTP)
 *   FS25_USER         utilisateur FTP                          (obligatoire)
 *   FS25_PASS         mot de passe FTP                         (obligatoire)
 *   FS25_PATH         chemin de status.xml sur le serveur      (obligatoire)
 *   FS25_REFRESH      secondes entre deux mises à jour         (défaut : 30)
 *   FS25_SERVER_NAME  nom affiché                              (défaut : Serveur FS25)
 *
 * Utilisation (dans ton fichier principal, après la création du client) :
 *   const { startFs25Bridge } = require('./fs25-bridge');
 *   client.once('ready', () => startFs25Bridge(client));
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Writable } = require('stream');
const { panneauEmbed } = require('./embed-format');

const MONTHS = ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
  'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février'];
const SEASONS = { 1: '🌸 Printemps', 2: '☀️ Été', 3: '🍂 Automne', 4: '❄️ Hiver' };
const FOOTER_TAG = 'FS25 Bridge'; // sert à retrouver le message après un redémarrage

const cfg = () => ({
  channelId: process.env.FS25_STATUS_CHANNEL_ID,
  source: (process.env.FS25_SOURCE || 'ftp').toLowerCase(),
  host: process.env.FS25_HOST,
  port: parseInt(process.env.FS25_FTP_PORT || (process.env.FS25_SOURCE === 'sftp' ? '22' : '21'), 10),
  user: process.env.FS25_USER,
  pass: process.env.FS25_PASS,
  path: process.env.FS25_PATH,
  refresh: parseInt(process.env.FS25_REFRESH || '30', 10),
  serverName: process.env.FS25_SERVER_NAME || 'Serveur FS25',
});

// ---------- Lecture du fichier sur le serveur ----------

async function readViaFtp(c) {
  const ftp = require('basic-ftp');
  const client = new ftp.Client(15000);
  try {
    await client.access({ host: c.host, port: c.port, user: c.user, password: c.pass, secure: false });
    const chunks = [];
    const sink = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
    await client.downloadTo(sink, c.path);
    let mtime = null;
    try { mtime = (await client.lastMod(c.path)).getTime(); } catch { /* MDTM non supporté */ }
    return { data: Buffer.concat(chunks).toString('utf8'), mtime };
  } finally {
    client.close();
  }
}

async function readViaSftp(c) {
  const SftpClient = require('ssh2-sftp-client');
  const sftp = new SftpClient();
  try {
    await sftp.connect({ host: c.host, port: c.port, username: c.user, password: c.pass, readyTimeout: 15000 });
    const stat = await sftp.stat(c.path);
    const buf = await sftp.get(c.path);
    return { data: buf.toString('utf8'), mtime: stat.modifyTime };
  } finally {
    await sftp.end().catch(() => {});
  }
}

// ---------- Analyse du XML (format simple, pas besoin de librairie) ----------

function attrs(tagText) {
  const out = {};
  for (const m of tagText.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function firstTag(xml, name) {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>`));
  return m ? attrs(m[0]) : {};
}

function allTags(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
}

function unescapeXml(s) {
  return (s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseStatus(xml) {
  const game = firstTag(xml, 'game');
  const time = firstTag(xml, 'time');
  const weather = firstTag(xml, 'weather');
  return {
    map: unescapeXml(game.mapTitle),
    timeScale: parseFloat(game.timeScale || '1'),
    hour: parseInt(time.hour || '0', 10),
    minute: parseInt(time.minute || '0', 10),
    period: parseInt(time.period || '1', 10),
    dayInPeriod: parseInt(time.dayInPeriod || '1', 10),
    daysPerPeriod: parseInt(time.daysPerPeriod || '1', 10),
    season: time.season !== undefined ? parseInt(time.season, 10) : null,
    year: parseInt(time.year || '1', 10),
    temperature: weather.temperature !== undefined ? parseFloat(weather.temperature) : null,
    farms: allTags(xml, 'farm').filter((f) => f.name).map((f) => ({
      name: unescapeXml(f.name) || '?',
      money: parseFloat(f.money || '0'),
      loan: parseFloat(f.loan || '0'),
    })),
    players: allTags(xml, 'player').map((p) => unescapeXml(p.name)).filter((n) => n && n !== 'Server'),
  };
}

// ---------- Construction de l'embed ----------

const money = (v) => `${Math.round(v).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;

function buildEmbed(d, mtime, c) {
  const online = !mtime || (Date.now() - mtime) < (c.refresh * 3 + 60) * 1000;
  const month = MONTHS[(d.period - 1 + 12) % 12];

  const embed = new EmbedBuilder()
    .setTitle(`${online ? '🟢' : '🔴'} ${c.serverName}`)
    .setColor(online ? 0x6aa84f : 0x999999)
    .setFooter({ text: FOOTER_TAG })
    .setTimestamp(new Date());

  const hhmm = `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
  const temp = d.temperature !== null && d.temperature > -900 ? `  ·  🌡️ ${Math.round(d.temperature)} °C` : '';
  const lines = [
    d.map ? `🗺️  Carte : **${d.map}**` : null,
    `🕒  Heure : **${hhmm}**  (x${Math.round(d.timeScale)})`,
    `📅  Date : **Jour ${d.dayInPeriod}/${d.daysPerPeriod}**  ·  ${month}  ·  Année ${d.year}`,
    `${SEASONS[d.season] || '—'}${temp}`,
  ].filter(Boolean);
  if (!online) lines.push('', '_Serveur hors ligne — dernières données connues._');
  embed.setDescription(lines.join('\n'));

  if (d.farms.length) {
    const nameW = Math.min(14, Math.max(...d.farms.map((f) => f.name.length), 5));
    const amountW = Math.max(...d.farms.map((f) => money(f.money).length), 6);
    const loanW = Math.max(...d.farms.map((f) => money(f.loan).length), 4);
    const head = `${'Ferme'.padEnd(nameW)}  ${'Argent'.padStart(amountW)}  ${'Prêt'.padStart(loanW)}`;
    const rows = d.farms.map((f) => `${f.name.slice(0, nameW).padEnd(nameW)}  ${money(f.money).padStart(amountW)}  ${(f.loan > 0 ? money(f.loan) : '—').padStart(loanW)}`);
    embed.addFields({ name: '💰  Finances', value: ['```', head, '─'.repeat(head.length), ...rows, '```'].join('\n').slice(0, 1024) });
  }
  embed.addFields({
    name: `👨‍🌾  Joueurs en ligne (${d.players.length})`,
    value: (d.players.length ? d.players.map((n) => `• ${n}`).join('\n') : '_Personne_').slice(0, 1024),
  });
  return embed;
}

function offlineEmbed(c, reason) {
  return new EmbedBuilder()
    .setTitle(`🔴 ${c.serverName}`)
    .setColor(0x999999)
    .setDescription(`_Impossible de joindre le serveur._\n\`${String(reason).slice(0, 200)}\``)
    .setFooter({ text: FOOTER_TAG })
    .setTimestamp(new Date());
}

// ---------- Journal des mouvements d'argent (déduit de l'écart entre deux relevés) ----------

// Un relevé toutes les 30 s : plusieurs opérations dans l'intervalle sont additionnées.
function moneyEvents(prev, cur, min) {
  const out = [];
  const ups = [], downs = [];
  for (const f of cur) {
    const p = prev.get(f.name);
    if (!p) continue;
    const dm = f.money - p.money, dl = f.loan - p.loan;
    if (Math.abs(dm) < min) continue;
    if (dl > 0 && Math.abs(dm - dl) < 1) out.push(`🏦 **${f.name}** a emprunté ${money(dl)}`);
    else if (dl < 0 && Math.abs(dm - dl) < 1) out.push(`🏦 **${f.name}** a remboursé ${money(-dl)} de prêt`);
    else (dm > 0 ? ups : downs).push({ name: f.name, amount: Math.abs(dm) });
  }
  for (const d of downs) {
    const i = ups.findIndex((u) => Math.abs(u.amount - d.amount) < 1);
    if (i >= 0) out.push(`💸 **${d.name}** → **${ups.splice(i, 1)[0].name}** : transfert de ${money(d.amount)}`);
    else out.push(`🔻 **${d.name}** a dépensé ${money(d.amount)}`);
  }
  for (const u of ups) out.push(`🔺 **${u.name}** a reçu ${money(u.amount)}`);
  return out;
}

function duration(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "moins d'1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

// Annonces connexion / déconnexion. `joined` est mis à jour ici.
function presenceEvents(joined, players, now = Date.now()) {
  const out = [];
  const first = joined.size === 0 && !joined.seeded;
  joined.seeded = true;
  for (const n of players) if (!joined.has(n)) { joined.set(n, now); if (!first) out.push(`🟢 **${n}** s'est connecté au serveur`); }
  for (const [n, t] of [...joined]) if (!players.includes(n)) { joined.delete(n); out.push(`🔴 **${n}** s'est déconnecté  ·  session ${duration(now - t)}`); }
  return out;
}

// ---------- Bouton « Liste des mods » ----------

const modsRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('fs_mods').setLabel('Liste des mods').setEmoji('📦').setStyle(ButtonStyle.Secondary),
);

let modsCache = { at: 0, lines: [] };

// Titres et versions lus dans le log de démarrage du serveur ; à défaut, noms des zips de /profile/mods.
async function fetchMods(c) {
  if (Date.now() - modsCache.at < 600000) return modsCache.lines;
  if (c.source !== 'sftp') throw new Error('Liste des mods disponible uniquement en SFTP.');
  const SftpClient = require('ssh2-sftp-client');
  const sftp = new SftpClient();
  try {
    await sftp.connect({ host: c.host, port: c.port, username: c.user, password: c.pass, readyTimeout: 15000 });
    const root = c.path.split('/modSettings/')[0]; // /profile
    const logs = (await sftp.list(root)).filter((f) => /^log_.*\.txt$/.test(f.name)).sort((a, b) => b.modifyTime - a.modifyTime);
    let lines = [];
    if (logs[0]) {
      const log = (await sftp.get(`${root}/${logs[0].name}`)).toString('utf8');
      lines = [...log.matchAll(/adding mod (.+?);(.+?);.*?;FS25_/g)].map((m) => `${m[1]} ${m[2]}`);
    }
    if (!lines.length) lines = (await sftp.list(`${root}/mods`)).filter((f) => /\.zip$/i.test(f.name)).map((f) => f.name.replace(/\.zip$/i, ''));
    modsCache = { at: Date.now(), lines: [...new Set(lines)].sort((a, b) => a.localeCompare(b, 'fr')) };
    return modsCache.lines;
  } finally {
    await sftp.end().catch(() => {});
  }
}

async function handleModsButton(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const lines = await fetchMods(cfg());
    const embeds = [];
    let cur = '';
    for (const l of lines.map((x) => `• ${x}`)) {
      if (cur.length + l.length + 1 > 3900) { embeds.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + l;
    }
    if (cur) embeds.push(cur);
    await interaction.editReply({
      embeds: embeds.map((d, i) => new EmbedBuilder().setColor(0x6aa84f).setDescription(d)
        .setTitle(i === 0 ? `📦 Mods du serveur (${lines.length})` : null)),
    });
  } catch (err) {
    await interaction.editReply(`Liste des mods indisponible : ${err.message}`).catch(() => {});
  }
}

// ---------- Boucle principale ----------

let lastStatus = null; // dernier état connu (utilisable par une commande /fs25)

async function findExistingMessage(channel, botId) {
  const msgs = await channel.messages.fetch({ limit: 100 });
  return msgs.find((m) => m.author.id === botId && m.embeds[0]?.footer?.text === FOOTER_TAG) || null;
}

// Message de statut unique. Le HUB l'appelle aussi pour le placer AU-DESSUS de ses panneaux (ordre : statut, infos, HUB).
let statusMsg = null;
let statusPending = null;
async function ensureStatusMessage(channel) {
  if (statusMsg) return statusMsg;
  statusPending ||= (async () => {
    statusMsg = await findExistingMessage(channel, channel.client.user.id).catch(() => null)
      || await channel.send({ embeds: [panneauEmbed(new EmbedBuilder().setTitle('⏳ Chargement du statut…').setColor(0x999999).setFooter({ text: FOOTER_TAG }).toJSON())], components: [] });
    return statusMsg;
  })().finally(() => { statusPending = null; });
  return statusPending;
}
const isStatusChannel = (channel) => !!process.env.FS25_HOST && process.env.FS25_STATUS_CHANNEL_ID === channel.id;

async function startFs25Bridge(client) {
  const c = cfg();
  const missing = ['channelId', 'host', 'user', 'pass', 'path'].filter((k) => !c[k]);
  if (missing.length) {
    console.warn(`[FS25] Module désactivé, variables manquantes : ${missing.join(', ')}`);
    return;
  }

  const channel = await client.channels.fetch(c.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[FS25] Salon ${c.channelId} introuvable ou non textuel.`);
    return;
  }

  let running = false;
  const logChannel = process.env.FS25_LOG_CHANNEL_ID ? await client.channels.fetch(process.env.FS25_LOG_CHANNEL_ID).catch(() => null) : null;
  const minMove = parseInt(process.env.FS25_LOG_MIN || '500', 10); // ignore les petits mouvements
  let prevFarms = null;
  const joined = new Map(); // joueur -> heure de connexion observée (le 1er relevé après un redémarrage du bot ne génère aucune annonce)

  const tick = async () => {
    if (running) return; // évite les chevauchements si le FTP est lent
    running = true;
    let embed;
    try {
      const { data, mtime } = c.source === 'sftp' ? await readViaSftp(c) : await readViaFtp(c);
      lastStatus = parseStatus(data);
      if (logChannel) {
        const lines = presenceEvents(joined, lastStatus.players); // aussi au 1er relevé : il mémorise les joueurs déjà présents
        if (prevFarms) {
          lines.push(...moneyEvents(prevFarms, lastStatus.farms, minMove));
          if (lines.length) logChannel.send({ content: lines.join('\n'), allowedMentions: { parse: [] } }).catch((e) => console.warn(`[FS25] Journal : ${e.message}`));
        }
        prevFarms = new Map(lastStatus.farms.map((f) => [f.name, f]));
      }
      embed = buildEmbed(lastStatus, mtime, c);
    } catch (err) {
      console.warn(`[FS25] Lecture impossible : ${err.message}`);
      embed = offlineEmbed(c, err.message);
    }
    try {
      const message = await ensureStatusMessage(channel);
      await message.edit({ embeds: [panneauEmbed(embed.toJSON())], components: [] }); // le bouton « Liste des mods » est dans le HUB INFORMATIONS
    } catch (err) {
      if (err.code === 10008) statusMsg = null; // message supprimé -> recréé au prochain tour
      else console.warn(`[FS25] Envoi Discord impossible : ${err.message}`);
    } finally {
      running = false;
    }
  };

  console.log(`[FS25] Pont démarré (${c.source.toUpperCase()} ${c.host}:${c.port}, toutes les ${c.refresh}s)`);
  await tick();
  setInterval(tick, c.refresh * 1000);
}

module.exports = {
  startFs25Bridge,
  ensureStatusMessage,
  isStatusChannel,
  moneyEvents,
  handleModsButton,
  presenceEvents,
  buildEmbed, // exporté pour les tests
  getLastFs25Status: () => lastStatus,
  parseStatus, // exporté pour les tests
};
