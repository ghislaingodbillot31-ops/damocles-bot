const fs   = require('fs');
const path = require('path');

const { dataPath } = require('./paths');
const CONFIG_PATH = dataPath('config.json');

// Config par défaut
const DEFAULT_CONFIG = {
  // Rôles
  VERIFICATION_ROLE_ID: '',
  REGLEMENT_ROLE_ID: '',
  ATTENTE_ROLE_ID: '',
  ACTIVE_ROLE_ID: '',
  INACTIVE_ROLE_ID: '',
  REGLES_ACCEPTEES_ROLE_ID: '',
  MUTE_ROLE_ID: '',
  TICKET_SUPPORT_ROLE_ID: '',

  // Salons
  VERIFICATION_CHANNEL_ID: '',
  REGLEMENT_CHANNEL_ID: '',
  ATTENTE_CHANNEL_ID: '',
  ACTIVATE_CHANNEL_ID: '',
  CHAT_CHANNEL_ID: '',
  LOG_CHANNEL_ID: '',
  STATUS_CHANNEL_ID: '',
  ROLES_CHANNEL_ID: '',
  DAMOCLES_LOG_CHANNEL_ID: '',
  TICKET_CATEGORY_ID: '',

  // Rôles exclus
  EXCLUDED_ROLE_IDS: '',

  // Sécurité
  RAID_THRESHOLD: 10,
  RAID_WINDOW_MS: 10000,
  SPAM_THRESHOLD: 5,
  SPAM_WINDOW_MS: 5000,

  // Inactivité
  INACTIVE_DAYS: 15,
  EXPEL_DAYS: 40,
};

function ensureDataDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function get() {
  ensureDataDir();

  // Charger depuis config.json si existe
  let fileConfig = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try { fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
    catch {}
  }

  // Merger avec les variables d'environnement (priorité au .env pour le token)
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    // Ces valeurs viennent toujours du .env
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID:     process.env.CLIENT_ID,
    GUILD_ID:      process.env.GUILD_ID,
    OWNER_ID:      process.env.OWNER_ID || '231500104844967937',
    DASHBOARD_SECRET: process.env.DASHBOARD_SECRET || 'damocles-secret-key',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  };
}

function set(newConfig) {
  ensureDataDir();
  const current = get();
  const toSave  = { ...current, ...newConfig };

  // Ne pas sauvegarder les valeurs sensibles dans config.json
  delete toSave.DISCORD_TOKEN;
  delete toSave.CLIENT_ID;
  delete toSave.GUILD_ID;
  delete toSave.OWNER_ID;
  delete toSave.DASHBOARD_SECRET;
  delete toSave.DISCORD_CLIENT_SECRET;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
  return get();
}

module.exports = { get, set, DEFAULT_CONFIG };
