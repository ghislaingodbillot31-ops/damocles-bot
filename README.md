# 🛡️ DAMOCLES · Bot Discord EUROAGRI

Bot Discord du serveur EUROAGRI (Farming Simulator 25) : accueil et vérification des arrivants, modération, HUB des exploitants, niveaux, boutique, tickets, et un dashboard web d'administration.

## Fonctionnalités

| Domaine | Ce que fait le bot | Fichiers |
|---|---|---|
| Arrivées | Vérification automatique, bouton règlement, MP et ping de bienvenue | `verification.js`, `welcome.js` |
| Sécurité | Anti-raid, anti-spam, liens suspects, détection des doubles comptes | `antiraid.js`, `antidoublecompte.js` |
| Modération | `/expulsion`, `/banid`, `/sanction`, purge d'une plage de messages (clic droit « Purge : début / fin ») | `src/commands/` |
| Inactivité | Analyse quotidienne à 04h00, `/analyse` | `activity.js`, `dailytasks.js` |
| HUB | HUB d'information (Règlement, Exploitant, Activité, Paramètre) au-dessus du HUB des exploitants (exploitation, contrats, besoins, annuaire, boutique) | `hub-info.js`, `hub.js`, `exploitation.js`, `commands/contrat.js`, `boutique.js` |
| Communauté | Niveaux et classement, anniversaires, salons vocaux temporaires, rôles à boutons, messages récurrents, tickets | `levels.js`, `birthday.js`, `tempvoice.js`, `roles.js`, `scheduled-messages.js`, `tickets.js` |
| Suivi | Salon de logs, statut du bot, surveillance du serveur FS25 | `logger.js`, `statusbot.js`, `fs25-monitor.js` |

## Dashboard

Servi par le bot lui-même (`src/dashboard.js`), sur le même port : `https://<service>.onrender.com`. Connexion avec Discord, réservée aux ID de `OWNER_IDS`.

Pages : tableau de bord, HUB d'information, exploitations, membres, configuration, logs, tickets, messages récurrents.

Après une modification dans `dashboard/src/`, recompiler puis commiter `dashboard/dist/` :

```bash
cd dashboard && npm install && npm run build
```

Pour que la connexion marche, ajouter `<DASHBOARD_URL>/auth/callback` dans Discord Developer Portal > OAuth2 > Redirects.

## Données

Tout est stocké en JSON dans le dossier donné par `DATA_DIR` (sur Render : le disque persistant), sinon dans `data/`. Tous les modules passent par `dataPath()` (`src/paths.js`). Au premier démarrage sur un disque vide, les fichiers de `data/` du dépôt y sont copiés (jamais écrasés ensuite).

Fichiers principaux : `members.json` (joueurs), `exploitations.json`, `hub-info.json`, `xp.json`, `config.json`, `scheduled-messages.json`.

Les joueurs étaient auparavant dans MongoDB. `data/members-depuis-mongo.json` est l'export de cette base : il est fusionné une seule fois dans `members.json` au démarrage (marqueur `.reprise-mongo-faite`).

## Installation

```bash
npm install
npm run deploy   # enregistre les commandes slash et clic droit auprès de Discord
npm start
```

Variables d'environnement (`.env` en local, onglet Environment sur Render) :

| Variable | Rôle |
|---|---|
| `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` | Bot et serveur |
| `DISCORD_CLIENT_SECRET`, `DASHBOARD_URL`, `DASHBOARD_SECRET` | Connexion au dashboard |
| `DATA_DIR` | Dossier des données (disque Render) |
| `*_ROLE_ID`, `*_CHANNEL_ID`, `TICKET_CATEGORY_ID`, `EXCLUDED_ROLE_IDS` | Rôles et salons (aussi réglables dans le dashboard, page Configuration) |

Intents privilégiés à activer dans le Developer Portal : Server Members et Message Content.

⚠️ Ne pas lancer `npm start` en local pendant que le bot tourne sur Render : deux bots avec le même token répondraient chacun aux clics.

## Scripts ponctuels

`setup.js`, `get-ids.js`, `give-reglement.js`, `reset-inactif.js` : outils à lancer à la main (`node <script>`), hors du bot.
