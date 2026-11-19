# Graph Report - Bot dominius  (2026-10-19)

## Corpus Check
- 81 files · ~64,746 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 987 nodes · 1847 edges · 59 communities (53 shown, 6 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 224 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f699c780`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scheduled-messages.js
- analyse.js
- levels.js
- birthday.js
- roles.js
- contrat.js
- hub.js
- boutique.js
- codeverif.js
- bugs.js
- temptext.js
- database.js
- fs25-monitor.js
- tempvoice.js
- index.js
- creer
- exploitation.js
- App.jsx
- invitations.js
- dashboard.js
- devDependencies
- embed-format.js
- welcome.js
- Messages
- statusbot.js
- panneau
- log
- Members
- setup-moncopainbot.js
- purge.js
- tickets.js
- Hubs.jsx
- xp-admin.js
- Exploitations.jsx
- dependencies
- antispam.js
- Dashboard
- antidoublecompte.js
- dataPath
- hub-info.js
- nettoyage.js
- ids.js
- config.js
- deployer-render.sh
- panneau-sync.test.js
- restart.js
- panneau-sync.js
- paths.js
- Tickets
- simple.js
- Messages.jsx
- bouton.js
- deploy-commands.js
- ajouter-bouton-reglement.js
- invite.js
- README.md

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 78 edges
2. `dataPath()` - 24 edges
3. `agrilog()` - 20 edges
4. `autoClean()` - 19 edges
5. `creer()` - 17 edges
6. `log()` - 16 edges
7. `handleModal()` - 13 edges
8. `publier()` - 13 edges
9. `panneauEmbed()` - 12 edges
10. `load()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/logger.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/activity.js
- `handleDecision()` --calls--> `agrilog()`  [EXTRACTED]
  src/boutique.js → src/agrilog.js
- `handleModal()` --calls--> `agrilog()`  [EXTRACTED]
  src/boutique.js → src/agrilog.js
- `handleHubAnnuaireDelYes()` --calls--> `agrilog()`  [EXTRACTED]
  src/hub.js → src/agrilog.js

## Import Cycles
- None detected.

## Communities (59 total, 6 thin omitted)

### Community 0 - "scheduled-messages.js"
Cohesion: 0.20
Nodes (19): ref_crypto, clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll() (+11 more)

### Community 1 - "analyse.js"
Cohesion: 0.07
Nodes (32): config, db, getDaysInactive(), getLastActivity(), getMemberStatus(), { inactiveDays: INACTIVE_DAYS, expelDays: EXPEL_DAYS }, _lastSeen, thresholds() (+24 more)

### Community 2 - "levels.js"
Cohesion: 0.06
Nodes (58): levels, { SlashCommandBuilder }, adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed() (+50 more)

### Community 3 - "birthday.js"
Cohesion: 0.14
Nodes (13): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids, MOIS, { panneau } (+5 more)

### Community 4 - "roles.js"
Cohesion: 0.16
Nodes (21): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs, headerEmbed(), ids (+13 more)

### Community 5 - "contrat.js"
Cohesion: 0.12
Nodes (39): agrilog(), ids, LOG_CHANNEL, ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide() (+31 more)

### Community 6 - "hub.js"
Cohesion: 0.08
Nodes (42): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), chunk(), exp, EXPLOITANT_ROLE_ID (+34 more)

### Community 7 - "boutique.js"
Cohesion: 0.10
Nodes (36): adminRoles(), { agrilog }, autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, cooldownRestant(), createRequest(), { dataPath }, decisionRow() (+28 more)

### Community 8 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 9 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 10 - "temptext.js"
Cohesion: 0.07
Nodes (49): {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), fs, handleModal(), handleWishModal(), handleWishVote() (+41 more)

### Community 11 - "database.js"
Cohesion: 0.14
Nodes (28): addWarning(), banMember(), cleanDatabase(), { dataPath, REPO_DATA }, DB_PATH, estVisible(), fs, getAbsentMembers() (+20 more)

### Community 12 - "fs25-monitor.js"
Cohesion: 0.11
Nodes (25): ref_http, panneauEmbed(), fetchStats(), formatUptime(), FS25_PORT, http, ids, NOTIF_CHANNEL (+17 more)

### Community 13 - "tempvoice.js"
Cohesion: 0.13
Nodes (27): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+19 more)

### Community 14 - "index.js"
Cohesion: 0.07
Nodes (26): { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat, { createDashboard, setClient } (+18 more)

### Community 15 - "creer"
Cohesion: 0.26
Nodes (17): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+9 more)

### Community 16 - "exploitation.js"
Cohesion: 0.17
Nodes (22): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+14 more)

### Community 17 - "App.jsx"
Cohesion: 0.21
Nodes (6): App(), dashboard_src_index, Config(), FIELDS, Login(), Logs()

### Community 18 - "invitations.js"
Cohesion: 0.13
Nodes (18): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL, ids (+10 more)

### Community 19 - "dashboard.js"
Cohesion: 0.16
Nodes (17): { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds, express, find() (+9 more)

### Community 20 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 21 - "embed-format.js"
Cohesion: 0.07
Nodes (31): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }, db, execute(), { panneau } (+23 more)

### Community 22 - "welcome.js"
Cohesion: 0.22
Nodes (13): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+5 more)

### Community 23 - "Messages"
Cohesion: 0.27
Nodes (5): Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 24 - "statusbot.js"
Cohesion: 0.15
Nodes (18): construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs, ids (+10 more)

### Community 25 - "panneau"
Cohesion: 0.18
Nodes (10): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau() (+2 more)

### Community 26 - "log"
Cohesion: 0.26
Nodes (11): checkLinks(), checkRaid(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log }, memberMessages, recentJoins (+3 more)

### Community 27 - "Members"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 28 - "setup-moncopainbot.js"
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 29 - "purge.js"
Cohesion: 0.21
Nodes (11): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+3 more)

### Community 30 - "tickets.js"
Cohesion: 0.18
Nodes (14): { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits }, execute(), { postTicketButton }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db (+6 more)

### Community 31 - "Hubs.jsx"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 32 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 33 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 34 - "dependencies"
Cohesion: 0.08
Nodes (24): discord.js, dotenv, express, express-session, multer, node-cron, node-fetch, dependencies (+16 more)

### Community 35 - "antispam.js"
Cohesion: 0.18
Nodes (13): { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau }, { PermissionFlagsBits }, { publier } (+5 more)

### Community 36 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 37 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 38 - "dataPath"
Cohesion: 0.18
Nodes (12): config, { dataPath }, db, expl, fs, hubInfo, levels, lire() (+4 more)

### Community 39 - "hub-info.js"
Cohesion: 0.21
Nodes (11): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, fs, get(), handleButton(), { panneau } (+3 more)

### Community 40 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 41 - "ids.js"
Cohesion: 0.18
Nodes (9): cfg, config, { agrilog }, { dataPath }, fs, jeu, mods, { panneau } (+1 more)

### Community 42 - "config.js"
Cohesion: 0.31
Nodes (8): CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path, set()

### Community 46 - "panneau-sync.test.js"
Cohesion: 0.28
Nodes (6): installer(), sansNotif(), assert, { formater }, { publier }, { sansNotif }

### Community 47 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 48 - "panneau-sync.js"
Cohesion: 0.43
Nodes (6): envoyerRapport(), formater(), ICONE, noter(), publier(), tampon

### Community 49 - "paths.js"
Cohesion: 0.33
Nodes (5): ref_fs, ref_path, fs, path, REPO_DATA

### Community 51 - "simple.js"
Cohesion: 0.60
Nodes (4): D, installer(), simple(), simplifier()

### Community 52 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

### Community 54 - "deploy-commands.js"
Cohesion: 0.50
Nodes (3): commands, rest, { REST, Routes }

## Knowledge Gaps
- **376 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+371 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `analyse.js`, `birthday.js`, `hub.js`, `boutique.js`, `codeverif.js`, `bugs.js`, `temptext.js`, `fs25-monitor.js`, `tempvoice.js`, `creer`, `invitations.js`, `dashboard.js`, `embed-format.js`, `welcome.js`, `statusbot.js`, `log`, `tickets.js`, `xp-admin.js`, `antispam.js`, `antidoublecompte.js`, `hub-info.js`, `ids.js`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `scheduled-messages.js`, `levels.js`, `roles.js`, `contrat.js`, `boutique.js`, `codeverif.js`, `bugs.js`, `temptext.js`, `database.js`, `tempvoice.js`, `creer`, `exploitation.js`, `invitations.js`, `dashboard.js`, `welcome.js`, `statusbot.js`, `antispam.js`, `hub-info.js`, `ids.js`, `config.js`, `paths.js`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `log()` connect `log` to `codeverif.js`, `purge.js`, `index.js`, `tickets.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _376 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analyse.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.059907834101382486 - nodes in this community are weakly interconnected._