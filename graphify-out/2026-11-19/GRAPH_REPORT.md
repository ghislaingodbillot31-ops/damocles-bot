# Graph Report - Bot dominius  (2026-11-14)

## Corpus Check
- 114 files · ~131,059 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1283 nodes · 2476 edges · 69 communities (65 shown, 4 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb7b3310`
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
- hub2.js
- devDependencies
- index.js
- database.js
- exploitation.js
- roles.js
- invitations.js
- dashboard.js
- jeux.js
- statusbot.js
- ref_node_sqlite
- maps.js
- boutique.js
- ref_fs
- scheduled-messages.js
- verification.js
- App.jsx
- antispam.js
- creer
- tickets.js
- setup-moncopainbot.js
- embed-format.js
- ids.js
- dataPath
- publier
- welcome.js
- purge.js
- bouton-info.js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- paths.js
- log
- xp-admin.js
- ref_discord_js
- DiscordBridge.lua
- niveau.js
- Liste des succès FS25
- Exploitations.jsx
- restart.js
- sync-db.js
- verifier.js
- startJeux
- Dashboard
- panneau
- deploy-commands.js
- nettoyage.js
- antidoublecompte.js
- Messages.jsx
- MonCopainBot
- deployer-render.sh
- moderation_roles_postrolesheader

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 100 edges
2. `dataPath()` - 28 edges
3. `agrilog()` - 21 edges
4. `creer()` - 17 edges
5. `publier()` - 17 edges
6. `autoClean()` - 16 edges
7. `panneauEmbed()` - 15 edges
8. `log()` - 15 edges
9. `startFs25Bridge()` - 15 edges
10. `handleContratAccepter()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `st()` --calls--> `parseStatus()`  [EXTRACTED]
  test/succes.test.js → src/farm/fs25-bridge.js
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/core/logger.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js
- `handleContratAccepter()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/contrat.js → src/core/embed-format.js

## Import Cycles
- None detected.

## Communities (69 total, 4 thin omitted)

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
Cohesion: 0.12
Nodes (51): actifs(), {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
}, alertes, auTotal(), cagnotte(), calcul(), CHANNEL_ID, { dataPath } (+43 more)

### Community 3 - "contrat.js"
Cohesion: 0.10
Nodes (44): ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide(), categorieNego(), CONTRAT_CHANNEL, contratSession (+36 more)

### Community 4 - "hub.js"
Cohesion: 0.10
Nodes (34): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), exp, EXPLOITANT_ROLE_ID, fermesLibres() (+26 more)

### Community 5 - "fs25-bridge.js"
Cohesion: 0.05
Nodes (63): { Client }, hub, { lireStatutUneFois }, succes, ref_assert, ref_basic_ftp, ref_ssh2_sftp_client, ref_stream (+55 more)

### Community 6 - "🚜 Travaux des champs"
Cohesion: 0.04
Nodes (46): ⏱️ Acharné (h), 🐕 Ami des chiens (caresses), 🍯 Apiculteur (L), 💰 Argent, 🥚 Aviculteur (œufs), 🟫 Botteleur (bottes), 🧑‍🌾 Bourreau de travail (ha), 🪓 Bûcheron (arbres) (+38 more)

### Community 7 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 8 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 9 - "birthday.js"
Cohesion: 0.14
Nodes (13): birthday, { SlashCommandBuilder }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids (+5 more)

### Community 10 - "tempvoice.js"
Cohesion: 0.13
Nodes (28): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+20 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (24): basic-ftp, discord.js, dotenv, express, express-session, node-cron, dependencies, basic-ftp (+16 more)

### Community 12 - "hub2.js"
Cohesion: 0.06
Nodes (50): C, {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
}, barre(), C, commercePayload(), decider(), demander(), estStaff() (+42 more)

### Community 13 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 14 - "index.js"
Cohesion: 0.07
Nodes (26): ref_node_cron, { annoncerArrivee, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat (+18 more)

### Community 15 - "database.js"
Cohesion: 0.05
Nodes (56): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep() (+48 more)

### Community 16 - "exploitation.js"
Cohesion: 0.18
Nodes (19): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+11 more)

### Community 17 - "roles.js"
Cohesion: 0.12
Nodes (23): roles, { SlashCommandBuilder, PermissionFlagsBits }, { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs (+15 more)

### Community 18 - "invitations.js"
Cohesion: 0.12
Nodes (20): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, classementPayload(), { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL (+12 more)

### Community 19 - "dashboard.js"
Cohesion: 0.13
Nodes (20): ref_crypto, ref_express, ref_express_session, { ChannelType }, construire(), createDashboard(), crypto, { dataPath } (+12 more)

### Community 20 - "jeux.js"
Cohesion: 0.14
Nodes (22): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+14 more)

### Community 21 - "statusbot.js"
Cohesion: 0.16
Nodes (18): construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs, ids (+10 more)

### Community 23 - "maps.js"
Cohesion: 0.15
Nodes (22): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
}, cartePayload(), { dataPath }, etoiles(), fs, handleDelete(), handleModal(), handleRate() (+14 more)

### Community 24 - "boutique.js"
Cohesion: 0.11
Nodes (31): boutique, { SlashCommandBuilder, PermissionFlagsBits }, { agrilog }, autoClean(), cooldownRestant(), createRequest(), { dataPath }, decisionRow() (+23 more)

### Community 25 - "ref_fs"
Cohesion: 0.08
Nodes (40): ref_fs, panneauEmbed(), { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), fs, handleButton(), handleSelect(), MEDALS (+32 more)

### Community 26 - "scheduled-messages.js"
Cohesion: 0.22
Nodes (18): clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll(), load() (+10 more)

### Community 27 - "verification.js"
Cohesion: 0.25
Nodes (10): { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton(), ids, ouvrirSalonRefus(), refuserSiPasAdmin(), runChecks() (+2 more)

### Community 28 - "App.jsx"
Cohesion: 0.15
Nodes (6): App(), Config(), FIELDS, Login(), Logs(), Tickets()

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
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 33 - "embed-format.js"
Cohesion: 0.21
Nodes (9): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP, avecIntro(), D, installer(), simple() (+1 more)

### Community 34 - "ids.js"
Cohesion: 0.17
Nodes (11): { agrilog }, { dataPath }, fs, ids, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} (+3 more)

### Community 35 - "dataPath"
Cohesion: 0.18
Nodes (12): dataPath(), config, { dataPath }, db, expl, fs, hubInfo, levels (+4 more)

### Community 36 - "publier"
Cohesion: 0.14
Nodes (16): installer(), sansNotif(), envoyerRapport(), formater(), ICONE, noter(), publier(), tampon (+8 more)

### Community 37 - "welcome.js"
Cohesion: 0.18
Nodes (12): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+4 more)

### Community 38 - "purge.js"
Cohesion: 0.21
Nodes (11): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+3 more)

### Community 39 - "bouton-info.js"
Cohesion: 0.33
Nodes (8): CHOIX, enregistrer(), execute(), handleModal(), info, lire(), {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
}, TEXTE

### Community 40 - "hub-info.js"
Cohesion: 0.19
Nodes (13): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, DYN, fs, get(), getIntro() (+5 more)

### Community 41 - "Members"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 42 - "Hubs.jsx"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 43 - "Messages"
Cohesion: 0.27
Nodes (5): Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 44 - "paths.js"
Cohesion: 0.19
Nodes (12): ref_path, CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path (+4 more)

### Community 45 - "log"
Cohesion: 0.31
Nodes (9): execute(), execute(), log(), checkLinks(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log } (+1 more)

### Community 46 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 47 - "ref_discord_js"
Cohesion: 0.25
Nodes (4): ref_discord_js, levels, { SlashCommandBuilder }, { SlashCommandBuilder }

### Community 48 - "DiscordBridge.lua"
Cohesion: 0.18
Nodes (7): DiscordBridge:collectOwned(), DiscordBridge:export(), DiscordBridge:loadMap(), DiscordBridge:trackWork(), isServer(), playerNick(), safe()

### Community 49 - "niveau.js"
Cohesion: 0.40
Nodes (5): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }

### Community 50 - "Liste des succès FS25"
Cohesion: 0.22
Nodes (8): 💰 Argent, 🎯 Divers, 🌾 Fourrage, forêt & atelier, Liste des succès FS25, 🏠 Possessions, 🛣️ Route & conduite, 🚜 Travaux des champs, 🐄 Élevage & ruches

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "sync-db.js"
Cohesion: 0.40
Nodes (5): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, syncDatabase()

### Community 54 - "verifier.js"
Cohesion: 0.40
Nodes (5): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, verifyMember()

### Community 55 - "startJeux"
Cohesion: 0.60
Nodes (5): panelPayload(), startJeux(), cacherAuxAutres(), salonAccueil(), visiblePar()

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 57 - "panneau"
Cohesion: 0.24
Nodes (8): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau(), { panneau }, reglementEmbed(), REGLES

### Community 58 - "deploy-commands.js"
Cohesion: 0.50
Nodes (3): commands, rest, { REST, Routes }

### Community 59 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 60 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 64 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

## Knowledge Gaps
- **489 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+484 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `temptext.js`, `association.js`, `contrat.js`, `hub.js`, `codeverif.js`, `bugs.js`, `birthday.js`, `tempvoice.js`, `hub2.js`, `database.js`, `invitations.js`, `dashboard.js`, `jeux.js`, `statusbot.js`, `maps.js`, `boutique.js`, `ref_fs`, `antispam.js`, `creer`, `tickets.js`, `embed-format.js`, `ids.js`, `welcome.js`, `hub-info.js`, `log`, `xp-admin.js`, `niveau.js`, `sync-db.js`, `startJeux`, `antidoublecompte.js`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `temptext.js`, `levels.js`, `association.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `hub2.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `jeux.js`, `statusbot.js`, `maps.js`, `boutique.js`, `ref_fs`, `scheduled-messages.js`, `antispam.js`, `creer`, `ids.js`, `welcome.js`, `hub-info.js`, `paths.js`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `panneauEmbed()` connect `ref_fs` to `levels.js`, `embed-format.js`, `fs25-bridge.js`, `roles.js`, `panneau`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _489 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._