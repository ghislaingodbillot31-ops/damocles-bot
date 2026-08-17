const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'feeds.json');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Timers actifs : feedId -> NodeJS.Timeout
const timers = new Map();

// ── Persistance ───────────────────────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DATA_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch { return []; }
}

function save(feeds) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(feeds, null, 2), 'utf-8');
}

function newId() { return crypto.randomBytes(8).toString('hex'); }

// ── CRUD ──────────────────────────────────────────────────────────────────────
function getAll() { return load(); }

function create(data) {
  const feeds = load();
  const feed = {
    id:              newId(),
    name:            data.name || 'Sans nom',
    type:            data.type, // youtube | reddit | twitch | rss
    source:          data.source, // channel_id, subreddit, login, url
    channelId:       data.channelId,
    intervalMinutes: parseInt(data.intervalMinutes) || 30,
    enabled:         data.enabled !== false,
    createdAt:       new Date().toISOString(),
    lastChecked:     null,
    lastPostId:      null, // ID du dernier post envoyé
    errorCount:      0,
  };
  feeds.push(feed);
  save(feeds);
  return feed;
}

function update(id, data, client) {
  const feeds = load();
  const idx = feeds.findIndex(f => f.id === id);
  if (idx === -1) return null;
  const updated = { ...feeds[idx], ...data, id };
  feeds[idx] = updated;
  save(feeds);
  clearTimer(id);
  if (updated.enabled && client) startTimer(updated, client);
  return updated;
}

function remove(id) {
  clearTimer(id);
  save(load().filter(f => f.id !== id));
}

// ── Parsers XML simple ────────────────────────────────────────────────────────
function extractXmlTag(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*' + attr + '=["\']([^"\']*)["\']', 'i'));
  return m ? m[1] : '';
}

// ── Fetchers par type ─────────────────────────────────────────────────────────

async function fetchYoutube(source) {
  // source = channel_id ou handle (@nom)
  let channelId = source;

  // Si c'est un handle @xxx, on résout via la page YouTube
  if (source.startsWith('@') || !source.startsWith('UC')) {
    // Essai direct avec le nom de chaîne via RSS
    const urlByName = 'https://www.youtube.com/feeds/videos.xml?user=' + encodeURIComponent(source.replace('@', ''));
    try {
      const r = await fetch(urlByName, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
      if (r.ok) {
        const xml = await r.text();
        return parseYoutubeRSS(xml);
      }
    } catch {}
    return null;
  }

  const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
    if (!r.ok) return null;
    const xml = await r.text();
    return parseYoutubeRSS(xml);
  } catch (err) {
    console.error('YouTube fetch error:', err.message);
    return null;
  }
}

function parseYoutubeRSS(xml) {
  const entries = xml.split('<entry>').slice(1);
  if (!entries.length) return null;
  const first = entries[0];
  const videoId = extractXmlTag(first, 'yt:videoId') || extractAttr(first, 'link', 'href').split('v=')[1];
  const title   = extractXmlTag(first, 'title');
  const author  = extractXmlTag(xml.split('<entry>')[0], 'title');
  const thumb   = videoId ? 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg' : null;
  return {
    id:       videoId,
    title,
    url:      videoId ? 'https://www.youtube.com/watch?v=' + videoId : '',
    author,
    thumb,
    type:     'youtube',
  };
}

async function fetchReddit(source) {
  // source = subreddit name (sans r/)
  const sub = source.replace(/^r\//, '');
  const url = 'https://www.reddit.com/r/' + sub + '/new.json?limit=1';
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'DamoclesBot/2.0' },
      timeout: 8000,
    });
    if (!r.ok) return null;
    const data = await r.json();
    const post = data?.data?.children?.[0]?.data;
    if (!post) return null;
    return {
      id:     post.id,
      title:  post.title,
      url:    'https://www.reddit.com' + post.permalink,
      author: 'u/' + post.author,
      thumb:  post.thumbnail?.startsWith('http') ? post.thumbnail : null,
      text:   post.selftext?.slice(0, 200) || null,
      subreddit: post.subreddit_name_prefixed,
      type:   'reddit',
    };
  } catch (err) {
    console.error('Reddit fetch error:', err.message);
    return null;
  }
}

async function fetchTwitch(source) {
  // source = login twitch (sans @)
  const login = source.replace('@', '').toLowerCase();
  // On scrape la page publique pour détecter si live (sans API key)
  const url = 'https://www.twitch.tv/' + login;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Chercher les métadonnées isLiveBroadcast dans le HTML
    const isLive = html.includes('"isLiveBroadcast":true') ||
                   html.includes('"type":"live"') ||
                   (html.includes('og:video') && !html.includes('"type":"vod"'));

    if (!isLive) return null;

    // Extraire le titre depuis les og:tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : login + ' est en live !';
    const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const thumb = imgMatch ? imgMatch[1] : null;

    return {
      id:    login + '_live_' + new Date().toISOString().slice(0, 13), // hourly ID
      title,
      url:   'https://www.twitch.tv/' + login,
      author: login,
      thumb,
      type:  'twitch',
    };
  } catch (err) {
    console.error('Twitch fetch error:', err.message);
    return null;
  }
}

async function fetchRSS(source) {
  try {
    const r = await fetch(source, {
      headers: { 'User-Agent': 'DamoclesBot/2.0' },
      timeout: 8000,
    });
    if (!r.ok) return null;
    const xml = await r.text();

    // Essai Atom
    const atomEntries = xml.split('<entry>').slice(1);
    if (atomEntries.length) {
      const first = atomEntries[0];
      const title = extractXmlTag(first, 'title');
      const link  = extractAttr(first, 'link', 'href') || extractXmlTag(first, 'link');
      const id    = extractXmlTag(first, 'id') || link;
      const author = extractXmlTag(first, 'name') || extractXmlTag(xml.split('<entry>')[0], 'title');
      return { id, title, url: link, author, thumb: null, type: 'rss' };
    }

    // RSS 2.0
    const items = xml.split('<item>').slice(1);
    if (items.length) {
      const first = items[0];
      const title = extractXmlTag(first, 'title');
      const link  = extractXmlTag(first, 'link');
      const guid  = extractXmlTag(first, 'guid') || link;
      const author = extractXmlTag(xml.split('<item>')[0], 'title');
      return { id: guid, title, url: link, author, thumb: null, type: 'rss' };
    }

    return null;
  } catch (err) {
    console.error('RSS fetch error:', err.message);
    return null;
  }
}

// ── Vérification et envoi ─────────────────────────────────────────────────────
async function checkFeed(feedId, client) {
  const feeds = load();
  const feed  = feeds.find(f => f.id === feedId);
  if (!feed || !feed.enabled) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(feed.channelId);
  if (!channel) return;

  let latest = null;
  try {
    switch (feed.type) {
      case 'youtube': latest = await fetchYoutube(feed.source); break;
      case 'reddit':  latest = await fetchReddit(feed.source);  break;
      case 'twitch':  latest = await fetchTwitch(feed.source);  break;
      case 'rss':     latest = await fetchRSS(feed.source);     break;
    }
  } catch (err) {
    console.error('Feed check error [' + feed.name + ']:', err.message);
    updateFeedMeta(feedId, { errorCount: (feed.errorCount || 0) + 1 });
    return;
  }

  updateFeedMeta(feedId, { lastChecked: new Date().toISOString(), errorCount: 0 });

  if (!latest || !latest.id) return;

  // Déjà posté ?
  if (latest.id === feed.lastPostId) return;

  // Nouveau contenu — on poste
  await sendFeedEmbed(channel, feed, latest);
  updateFeedMeta(feedId, { lastPostId: latest.id });
  console.log('📡 Feed [' + feed.name + '] — nouveau contenu posté : ' + latest.title);
}

function updateFeedMeta(feedId, meta) {
  const feeds = load();
  const idx = feeds.findIndex(f => f.id === feedId);
  if (idx !== -1) {
    Object.assign(feeds[idx], meta);
    save(feeds);
  }
}

async function sendFeedEmbed(channel, feed, content) {
  const COLORS = { youtube: 0xFF0000, reddit: 0xFF4500, twitch: 0x9146FF, rss: 0x5865F2 };
  const ICONS  = { youtube: '▶️ YouTube', reddit: '🟠 Reddit', twitch: '🟣 Twitch', rss: '📡 RSS' };

  const embed = {
    color: COLORS[feed.type] || 0x5865F2,
    author: { name: ICONS[feed.type] + (content.author ? ' • ' + content.author : '') },
    title: content.title || 'Nouveau contenu',
    url:   content.url || undefined,
    footer: { text: feed.name + ' — Damoclès Bot' },
    timestamp: new Date().toISOString(),
  };

  if (content.thumb) embed.image = { url: content.thumb };
  if (content.text)  embed.description = content.text + (content.text.length >= 200 ? '...' : '');

  // Badge spécial Twitch
  if (feed.type === 'twitch') {
    embed.description = '🔴 **EN LIVE MAINTENANT**\n' + content.url;
  }

  await channel.send({ embeds: [embed] }).catch(err =>
    console.error('Erreur envoi feed embed:', err.message)
  );
}

// ── Timers ────────────────────────────────────────────────────────────────────
function clearTimer(id) {
  if (timers.has(id)) {
    clearInterval(timers.get(id));
    timers.delete(id);
  }
}

function startTimer(feed, client) {
  if (!feed.enabled || !client) return;
  clearTimer(feed.id);
  const ms = feed.intervalMinutes * 60 * 1000;
  const timer = setInterval(() => checkFeed(feed.id, client), ms);
  timers.set(feed.id, timer);
}

function startAll(client) {
  const feeds = load();
  let started = 0;
  for (const feed of feeds) {
    if (feed.enabled) {
      startTimer(feed, client);
      started++;
    }
  }
  if (started > 0) console.log('📡 ' + started + ' flux d\'annonces démarrés');
}

async function checkNow(feedId, client) {
  await checkFeed(feedId, client);
}

module.exports = { getAll, create, update, remove, startAll, startTimer, checkNow };
