# Graph Report - Bot dominius  (2026-10-18)

## Corpus Check
- 80 files · ~61,371 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 935 nodes · 1801 edges · 46 communities (43 shown, 3 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 73 edges
2. `discord.js` - 40 edges
3. `dataPath()` - 23 edges
4. `agrilog()` - 20 edges
5. `autoClean()` - 19 edges
6. `creer()` - 17 edges
7. `log()` - 16 edges
8. `handleModal()` - 13 edges
9. `react` - 12 edges
10. `panneauEmbed()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/embed-format.js
- `postHub()` --calls--> `panneau()`  [EXTRACTED]
  src/hub.js → src/embed-format.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/activity.js
- `handleDecision()` --calls--> `agrilog()`  [EXTRACTED]
  src/boutique.js → src/agrilog.js
- `handleModal()` --calls--> `agrilog()`  [EXTRACTED]
  src/boutique.js → src/agrilog.js

## Import Cycles
- None detected.

## Communities (46 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (57): ref_fs, config, { dataPath }, db, expl, fs, hubInfo, levels (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (50): config, db, getDaysInactive(), getLastActivity(), getMemberStatus(), { inactiveDays: INACTIVE_DAYS, expelDays: EXPEL_DAYS }, _lastSeen, thresholds() (+42 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (55): adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed(), baremeTexte(), cacheInvites() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (32): discord.js, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids, MOIS (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (38): ref_path, CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path (+30 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (39): agrilog(), ids, LOG_CHANNEL, ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide() (+31 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (38): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), chunk(), exp, EXPLOITANT_ROLE_ID (+30 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (34): adminRoles(), { agrilog }, autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, cooldownRestant(), createRequest(), { dataPath }, decisionRow() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (29): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), creerSalon(), { dataPath }, dernierMessage(), fs (+21 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (28): addWarning(), banMember(), cleanDatabase(), { dataPath, REPO_DATA }, DB_PATH, estVisible(), fs, getAbsentMembers() (+20 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (25): ref_http, panneauEmbed(), fetchStats(), formatUptime(), FS25_PORT, http, ids, NOTIF_CHANNEL (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (27): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (26): { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat, { createDashboard, setClient } (+18 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (24): { agrilog }, creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew() (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (22): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (9): App(), dashboard_src_index, Config(), FIELDS, Login(), Logs(), Tickets(), react (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (17): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL, ids (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (18): ref_crypto, { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds, express (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (16): dependencies, react, react-dom, react-router-dom, name, scripts, build, dev (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (15): panneau(), annoncerArrivee(), CONFIG_PATH, { dataPath }, fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (8): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS, Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (10): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP, { ActionRowBuilder, ButtonBuilder, ButtonStyle }, { panneau }, payload() (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (11): checkLinks(), checkRaid(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log }, memberMessages, recentJoins (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): description, main, name, version, dotenv, express, express-session, multer (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (10): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), key(), { log } (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.27
Nodes (10): { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db, historique(), { log }, { panneau } (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 33 - "Community 33"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (8): dependencies, discord.js, dotenv, express, express-session, multer, node-cron, node-fetch

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (6): devDependencies, autoprefixer, postcss, tailwindcss, vite, @vitejs/plugin-react

### Community 36 - "Community 36"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 37 - "Community 37"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (5): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (5): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, syncDatabase()

### Community 40 - "Community 40"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 41 - "Community 41"
Cohesion: 0.50
Nodes (4): { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits }, execute(), { postTicketButton }, postTicketButton()

### Community 42 - "Community 42"
Cohesion: 0.50
Nodes (4): scripts, deploy, setup, start

## Knowledge Gaps
- **356 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+351 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 406 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `discord.js` connect `Community 3` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 18`, `Community 19`, `Community 21`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 32`, `Community 38`, `Community 39`, `Community 41`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **Why does `panneau()` connect `Community 22` to `Community 0`, `Community 1`, `Community 3`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 15`, `Community 18`, `Community 19`, `Community 25`, `Community 26`, `Community 30`, `Community 32`, `Community 37`, `Community 38`, `Community 39`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 22`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _356 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05182443151771549 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05084745762711865 - nodes in this community are weakly interconnected._