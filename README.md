# MonCopainBot

MonCopainBot : bot Discord du serveur Le Coin des Copains (aucune donnée ni token partagés avec un autre bot).

1. Créer une application Discord dédiée (Developer Portal), copier le token et l'ID dans `.env` (`DISCORD_TOKEN`, `CLIENT_ID`).
2. Inviter le bot sur Le Coin des Copains (scope `bot` + `applications.commands`, permission Administrateur).
3. `npm install`, puis `npm run deploy` (commandes slash), puis `npm start`.
`npm run setup` recrée les salons et les rôles (voir `setup-moncopainbot.js`).
Données : `./data` (créées au premier lancement).

## Organisation du code (`src/`)
- `index.js` : démarrage et routage des interactions · `deploy-commands.js` : commandes slash
- `core/` : config, ids, chemins, base de données, logs, embeds, nettoyage, redémarrage, messages planifiés
- `moderation/` : vérification, anti-raid/spam/doublons, règlement, rôles, accueil, invitations, tickets
- `community/` : niveaux, anniversaires, événements, jeux, suggestions, bugs, salons temporaires
- `farm/` : exploitations, hub, boutique, marché, pont FS25
- `web/` : tableau de bord et API admin · `commands/` : commandes slash · `multifruit/` : mini-jeu
Graphe du code : `graphify-out/graph.html`.
