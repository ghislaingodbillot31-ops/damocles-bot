# Graph Report - Bot dominius  (2026-11-20)

## Corpus Check
- 127 files · ~140,290 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 1, .seeded 1, .db 1)

## Summary
- 1444 nodes · 2847 edges · 79 communities (70 shown, 9 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 307 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb06a109`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- temptext.js
- levels.js
- association.js
- contrat.js
- hub.js
- fs25-bridge.js
- 🚜 Travaux des champs
- codeverif.js
- bugs.js
- birthday.js
- tempvoice.js
- dependencies
- fs25-succes.js
- dashboard/package.json
- index.js
- database.js
- exploitation.js
- roles.js
- invitations.js
- dashboard.js
- salon-exploitation.js
- statusbot.js
- ref_node_sqlite
- maps.js
- boutique.js
- marche.js
- scheduled-messages.js
- verification.js
- App.jsx
- antispam.js
- creer
- tickets.js
- setup-moncopainbot.js
- embed-format.js
- ids.js
- admin-api.js
- publier
- welcome.js
- purge.js
- jeux.js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- config.js
- log
- xp-admin.js
- discord.js
- DiscordBridge.lua
- hub2.js
- Liste des succès FS25
- Exploitations.jsx
- restart.js
- loto.js
- activites-sup.js
- credit.js
- Dashboard
- panneau
- droits-texte.js
- nettoyage.js
- antidoublecompte.js
- succes-paliers.js
- paths.js
- package.json
- hub-local.js
- devDependencies
- classement.js
- niveau.js
- MonCopainBot
- deployer-render.sh
- sync-db.js
- moderation_roles_postrolesheader
- scripts
- startJeux
- anniversaire.js
- deploy-commands.js

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 107 edges
2. `discord.js` - 57 edges
3. `dataPath()` - 32 edges
4. `agrilog()` - 25 edges
5. `autoClean()` - 19 edges
6. `publier()` - 19 edges
7. `creer()` - 17 edges
8. `handle()` - 16 edges
9. `panneauEmbed()` - 15 edges
10. `log()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `st()` --calls--> `parseStatus()`  [EXTRACTED]
  test/succes.test.js → src/farm/fs25-bridge.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js
- `handleContratAccepter()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/contrat.js → src/core/embed-format.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/community/activity.js

## Import Cycles
- None detected.

## Communities (79 total, 9 thin omitted)

### Community 0 - "temptext.js"
Cohesion: 0.13
Nodes (27): autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), creerSalon(), { dataPath }, dernierMessage(), fs, handleTextControl() (+19 more)

### Community 1 - "levels.js"
Cohesion: 0.07
Nodes (55): adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed(), baremeTexte(), cacheInvites() (+47 more)

### Community 2 - "association.js"
Cohesion: 0.10
Nodes (65): actifs(), {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder,
}, adminPanel(), alertes, auTotal(), CHANNEL_ID, clotureElection(), commissionPresident() (+57 more)

### Community 3 - "contrat.js"
Cohesion: 0.07
Nodes (61): ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide(), categorieNego(), CONTRAT_CHANNEL, contratSession (+53 more)

### Community 4 - "hub.js"
Cohesion: 0.10
Nodes (39): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), choixActivites(), exp, EXPLOITANT_ROLE_ID (+31 more)

### Community 5 - "fs25-bridge.js"
Cohesion: 0.05
Nodes (53): ref_assert, basic-ftp, ssh2-sftp-client, ref_stream, execute(), { lireDonneesCompletes }, { sectionEmbed }, { SlashCommandBuilder } (+45 more)

### Community 6 - "🚜 Travaux des champs"
Cohesion: 0.04
Nodes (46): 🐕 Ami des chiens (caresses), 🐝 Apiculteur (ruches), 💰 Argent, 🥚 Aviculteur (œufs), 🟫 Botteleur (bottes), 🛣️ Bouffeur de bitume (km), 🪓 Bûcheron (arbres), 🚛 Camionneur (km) (+38 more)

### Community 7 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 8 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 9 - "birthday.js"
Cohesion: 0.19
Nodes (11): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids, MOIS, { panneau } (+3 more)

### Community 10 - "tempvoice.js"
Cohesion: 0.13
Nodes (28): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+20 more)

### Community 11 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, basic-ftp, discord.js, dotenv, express, express-session, node-cron, ssh2-sftp-client

### Community 12 - "fs25-succes.js"
Cohesion: 0.07
Nodes (41): execute(), { resetSalon, getStatus }, { SlashCommandBuilder, PermissionFlagsBits }, bar(), computeUnlocks(), arrondi(), C, proposition() (+33 more)

### Community 13 - "dashboard/package.json"
Cohesion: 0.12
Nodes (16): dependencies, react, react-dom, react-router-dom, name, scripts, build, dev (+8 more)

### Community 14 - "index.js"
Cohesion: 0.07
Nodes (26): { annoncerArrivee, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat, { createDashboard, setClient } (+18 more)

### Community 15 - "database.js"
Cohesion: 0.05
Nodes (56): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep() (+48 more)

### Community 16 - "exploitation.js"
Cohesion: 0.18
Nodes (20): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+12 more)

### Community 17 - "roles.js"
Cohesion: 0.06
Nodes (46): ref_fs, roles, { SlashCommandBuilder, PermissionFlagsBits }, panneauEmbed(), { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), fs, handleButton() (+38 more)

### Community 18 - "invitations.js"
Cohesion: 0.12
Nodes (20): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, classementPayload(), { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL (+12 more)

### Community 19 - "dashboard.js"
Cohesion: 0.15
Nodes (18): ref_crypto, { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds, express (+10 more)

### Community 20 - "salon-exploitation.js"
Cohesion: 0.17
Nodes (15): panneauDroits(), CATEGORIE, { ChannelType, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle }, droitsPayload(), ensure(), ensureInterne(), exp, files (+7 more)

### Community 21 - "statusbot.js"
Cohesion: 0.16
Nodes (18): construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs, ids (+10 more)

### Community 23 - "maps.js"
Cohesion: 0.15
Nodes (22): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
}, cartePayload(), { dataPath }, etoiles(), fs, handleDelete(), handleModal(), handleRate() (+14 more)

### Community 24 - "boutique.js"
Cohesion: 0.14
Nodes (28): { agrilog }, autoClean(), cooldownRestant(), createRequest(), { dataPath }, decisionRow(), demandeEmbed(), estAdmin() (+20 more)

### Community 25 - "marche.js"
Cohesion: 0.18
Nodes (21): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, champ(), { dataPath }, ERREUR, fmt(), fs, handleAjouter(), handleGerer() (+13 more)

### Community 26 - "scheduled-messages.js"
Cohesion: 0.22
Nodes (18): clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll(), load() (+10 more)

### Community 27 - "verification.js"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

### Community 28 - "App.jsx"
Cohesion: 0.16
Nodes (9): App(), dashboard_src_index, Config(), FIELDS, Login(), Logs(), Tickets(), react (+1 more)

### Community 29 - "antispam.js"
Cohesion: 0.18
Nodes (13): { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau }, { PermissionFlagsBits }, { publier } (+5 more)

### Community 30 - "creer"
Cohesion: 0.31
Nodes (15): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+7 more)

### Community 31 - "tickets.js"
Cohesion: 0.21
Nodes (14): { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db, estSupport(), historique(), { log } (+6 more)

### Community 32 - "setup-moncopainbot.js"
Cohesion: 0.13
Nodes (11): ref_path, CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs (+3 more)

### Community 33 - "embed-format.js"
Cohesion: 0.21
Nodes (9): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP, avecIntro(), D, installer(), simple() (+1 more)

### Community 34 - "ids.js"
Cohesion: 0.17
Nodes (11): { agrilog }, { dataPath }, fs, ids, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} (+3 more)

### Community 35 - "admin-api.js"
Cohesion: 0.18
Nodes (11): config, { dataPath }, db, expl, fs, hubInfo, levels, lire() (+3 more)

### Community 36 - "publier"
Cohesion: 0.14
Nodes (16): installer(), sansNotif(), envoyerRapport(), formater(), ICONE, noter(), publier(), tampon (+8 more)

### Community 37 - "welcome.js"
Cohesion: 0.18
Nodes (12): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+4 more)

### Community 38 - "purge.js"
Cohesion: 0.19
Nodes (11): collectRange(), data, dataEnd, dataStart, executeEnd(), executeStart(), key(), { log } (+3 more)

### Community 39 - "jeux.js"
Cohesion: 0.14
Nodes (22): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+14 more)

### Community 40 - "hub-info.js"
Cohesion: 0.11
Nodes (22): CHOIX, enregistrer(), execute(), handleModal(), info, lire(), {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
}, TEXTE (+14 more)

### Community 41 - "Members"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 42 - "Hubs.jsx"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 43 - "Messages"
Cohesion: 0.18
Nodes (8): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS, Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 44 - "config.js"
Cohesion: 0.31
Nodes (8): CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path, set()

### Community 45 - "log"
Cohesion: 0.27
Nodes (10): execute(), handleButton(), execute(), log(), checkLinks(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS (+2 more)

### Community 46 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 47 - "discord.js"
Cohesion: 0.18
Nodes (5): discord.js, boutique, { SlashCommandBuilder, PermissionFlagsBits }, { SlashCommandBuilder }, { SlashCommandBuilder, PermissionFlagsBits }

### Community 48 - "DiscordBridge.lua"
Cohesion: 0.15
Nodes (11): DiscordBridge:collectOwned(), DiscordBridge:export(), DiscordBridge:exportFull(), DiscordBridge:loadMap(), DiscordBridge:trackWork(), farmName(), fillLevels(), isServer() (+3 more)

### Community 49 - "hub2.js"
Cohesion: 0.17
Nodes (17): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
}, classement(), commercePayload(), exp, fermesDuJoueur(), handle(), headPayload(), HUB2_CHANNEL (+9 more)

### Community 50 - "Liste des succès FS25"
Cohesion: 0.22
Nodes (8): 💰 Argent, 🎯 Divers, 🌾 Fourrage, forêt & atelier, Liste des succès FS25, 🏠 Possessions, 🛣️ Route & conduite, 🚜 Travaux des champs, 🐄 Élevage & ruches

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "loto.js"
Cohesion: 0.17
Nodes (22): { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder }, brouillons, { dataPath }, fmt(), fs, GAINS, grilleUI(), handleButton() (+14 more)

### Community 54 - "activites-sup.js"
Cohesion: 0.18
Nodes (18): achetables(), { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits }, { CHOIX, ELEVAGE_INDIV, parNom }, decider(), demander(), estStaff(), eur(), exp (+10 more)

### Community 55 - "credit.js"
Cohesion: 0.24
Nodes (13): logsSalon(), nomAffiche(), { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits }, choisir(), estAdmin(), eur(), exp, handle() (+5 more)

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 57 - "panneau"
Cohesion: 0.22
Nodes (9): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau(), handleBoutique(), { panneau }, reglementEmbed() (+1 more)

### Community 58 - "droits-texte.js"
Cohesion: 0.14
Nodes (13): ACTIVITES, ANCIENS, CER, ELEVAGE, ENGRAIS, FOUR, LISTE, MARA (+5 more)

### Community 59 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 60 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 62 - "succes-paliers.js"
Cohesion: 0.23
Nodes (11): appliquer(), calcul(), { dataPath }, defauts, FILE, fs, init(), liste() (+3 more)

### Community 63 - "paths.js"
Cohesion: 0.22
Nodes (9): dataPath(), fs, path, REPO_DATA, { dataPath }, exp, fs, run() (+1 more)

### Community 64 - "package.json"
Cohesion: 0.22
Nodes (8): description, main, name, version, dotenv, express, express-session, node-cron

### Community 65 - "hub-local.js"
Cohesion: 0.29
Nodes (5): { Client }, hub, { lireStatutUneFois }, succes, src_farm_fs25_bridge_lirestatutunefois

### Community 66 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, autoprefixer, postcss, tailwindcss, vite, @vitejs/plugin-react

### Community 68 - "niveau.js"
Cohesion: 0.40
Nodes (5): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }

### Community 73 - "sync-db.js"
Cohesion: 0.40
Nodes (5): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, syncDatabase()

### Community 75 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, deploy, setup, start, test

### Community 76 - "startJeux"
Cohesion: 0.60
Nodes (5): panelPayload(), startJeux(), cacherAuxAutres(), salonAccueil(), visiblePar()

### Community 78 - "deploy-commands.js"
Cohesion: 0.50
Nodes (3): commands, rest, { REST, Routes }

## Knowledge Gaps
- **548 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+543 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 631 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `discord.js` connect `discord.js` to `temptext.js`, `association.js`, `contrat.js`, `hub.js`, `fs25-bridge.js`, `codeverif.js`, `bugs.js`, `birthday.js`, `tempvoice.js`, `fs25-succes.js`, `index.js`, `database.js`, `roles.js`, `invitations.js`, `dashboard.js`, `salon-exploitation.js`, `maps.js`, `boutique.js`, `marche.js`, `verification.js`, `antispam.js`, `tickets.js`, `setup-moncopainbot.js`, `embed-format.js`, `ids.js`, `publier`, `purge.js`, `jeux.js`, `hub-info.js`, `xp-admin.js`, `hub2.js`, `loto.js`, `activites-sup.js`, `credit.js`, `panneau`, `package.json`, `hub-local.js`, `classement.js`, `niveau.js`, `sync-db.js`, `anniversaire.js`, `deploy-commands.js`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `panneau()` connect `panneau` to `temptext.js`, `association.js`, `contrat.js`, `hub.js`, `codeverif.js`, `bugs.js`, `birthday.js`, `tempvoice.js`, `database.js`, `roles.js`, `invitations.js`, `dashboard.js`, `salon-exploitation.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `antispam.js`, `creer`, `tickets.js`, `embed-format.js`, `ids.js`, `welcome.js`, `jeux.js`, `hub-info.js`, `log`, `xp-admin.js`, `hub2.js`, `loto.js`, `activites-sup.js`, `antidoublecompte.js`, `niveau.js`, `sync-db.js`, `startJeux`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `paths.js` to `temptext.js`, `levels.js`, `association.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `fs25-succes.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `scheduled-messages.js`, `antispam.js`, `creer`, `ids.js`, `admin-api.js`, `welcome.js`, `jeux.js`, `hub-info.js`, `config.js`, `loto.js`, `succes-paliers.js`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _548 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._