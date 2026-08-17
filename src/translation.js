const fs   = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const DATA_PATH = path.join(__dirname, '..', 'data', 'translation.json');

// ── Persistance config ────────────────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(DATA_PATH)) return { enabled: false, channels: [] };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch { return { enabled: false, channels: [] }; }
}

function saveConfig(cfg) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function getConfig()          { return loadConfig(); }
function setConfig(newCfg)    { saveConfig({ ...loadConfig(), ...newCfg }); return getConfig(); }
function isChannelEnabled(id) {
  const cfg = loadConfig();
  return cfg.enabled && cfg.channels.includes(id);
}

// ── Détection de langue ───────────────────────────────────────────────────────
function detectLang(text) {
  const t = text.toLowerCase();

  const frWords = ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'est', 'sont',
    'avec', 'dans', 'pour', 'sur', 'par', 'que', 'qui', 'pas', 'ne', 'ce',
    'mais', 'ou', 'donc', 'car', 'si', 'plus', 'bien', 'tout', 'tres', 'aussi',
    'comme', 'quand', 'alors', 'apres', 'avant', 'chez', 'sans', 'sous', 'moi',
    'toi', 'lui', 'eux', 'mon', 'ton', 'son', 'notre', 'votre', 'leur'];

  const enWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'i', 'you', 'he', 'she', 'we', 'they', 'it', 'my', 'your', 'his', 'her',
    'our', 'their', 'this', 'that', 'with', 'for', 'on', 'at', 'from', 'to',
    'in', 'of', 'and', 'or', 'not', 'but', 'if', 'so', 'just', 'what', 'how',
    'when', 'where', 'who', 'can', 'get', 'got', 'im', 'its'];

  const words = t.split(/\s+/);
  let frScore = 0, enScore = 0;

  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '');
    if (frWords.includes(clean)) frScore++;
    if (enWords.includes(clean)) enScore++;
    // Accents français = fort indice
    if (/[àâäéèêëîïôöùûüç]/.test(w)) frScore += 2;
  }

  if (frScore === 0 && enScore === 0) return null;
  if (frScore > enScore) return 'fr';
  if (enScore > frScore) return 'en';
  return null;
}

// ── Traduction via MyMemory (gratuit, sans clé) ───────────────────────────────
async function translate(text, sourceLang, targetLang) {
  const url = 'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=' + sourceLang + '|' + targetLang;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DamoclesBot/2.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      // MyMemory retourne parfois une erreur dans le texte
      if (translated.includes('MYMEMORY WARNING') || translated.includes('YOU USED ALL AVAILABLE FREE TRANSLATIONS')) {
        console.log('🌐 MyMemory quota atteint');
        return null;
      }
      return { text: translated };
    }
    return null;
  } catch (err) {
    console.error('🌐 Erreur traduction MyMemory:', err.message, err.code || '');
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
async function handleMessage(message) {
  if (!isChannelEnabled(message.channel.id)) return;
  if (message.author.bot) return;

  const content = message.content.trim();
  if (content.length < 8) return;
  if (content.startsWith('/') || content.startsWith('!')) return;
  if (/^https?:\/\/\S+$/.test(content)) return;

  const lang = detectLang(content);
  if (!lang) {
    console.log('🌐 Langue non détectée : ' + content.slice(0, 40));
    return;
  }

  const targetLang  = lang === 'fr' ? 'en' : 'fr';
  const targetLabel = targetLang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English';
  const sourceLabel = lang === 'fr' ? '🇫🇷' : '🇬🇧';

  console.log('🌐 Traduction ' + lang + ' → ' + targetLang + ' : ' + content.slice(0, 50));

  const result = await translate(content, lang, targetLang);
  if (!result) {
    console.log('🌐 Traduction échouée');
    return;
  }

  // Ignorer si la traduction est identique
  if (result.text.toLowerCase().trim() === content.toLowerCase().trim()) return;

  console.log('🌐 Traduit : ' + result.text.slice(0, 50));

  await message.reply({
    embeds: [{
      description: sourceLabel + ' → **' + targetLabel + '**\n\n' + result.text,
      color: lang === 'fr' ? 0x3498DB : 0x2ECC71,
      footer: { text: 'Traduction automatique — Damoclès Bot' },
    }],
    allowedMentions: { repliedUser: false },
  }).catch(err => console.error('🌐 Erreur reply:', err.message));
}

module.exports = { handleMessage, getConfig, setConfig, isChannelEnabled };
