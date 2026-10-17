# Bot DOMINIUS

Bot Discord indépendant du serveur DOMINIUS (code copié du bot Damoclès, aucune donnée ni token partagés).

1. Créer une application Discord dédiée (Developer Portal), copier le token et l'ID dans `.env` (`DISCORD_TOKEN`, `CLIENT_ID`).
2. Inviter le bot sur DOMINIUS (scope `bot` + `applications.commands`, permission Administrateur).
3. `npm install`, puis `npm run deploy` (commandes slash), puis `npm start`.
`npm run setup` recrée les salons et les rôles (voir `setup-dominius.js`).
Données : `./data` (créées au premier lancement).
