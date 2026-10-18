# MonCopainBot

MonCopainBot : bot Discord du serveur Le Coin des Copains (aucune donnée ni token partagés avec un autre bot).

1. Créer une application Discord dédiée (Developer Portal), copier le token et l'ID dans `.env` (`DISCORD_TOKEN`, `CLIENT_ID`).
2. Inviter le bot sur Le Coin des Copains (scope `bot` + `applications.commands`, permission Administrateur).
3. `npm install`, puis `npm run deploy` (commandes slash), puis `npm start`.
`npm run setup` recrée les salons et les rôles (voir `setup-moncopainbot.js`).
Données : `./data` (créées au premier lancement).
