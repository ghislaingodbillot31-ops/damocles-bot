// Règlement FS25 : 3 blocs (embeds) affichés d'un coup par le bouton « Règlement », avec « Fermer » en bas.
const BLOCS = [
`Le staff a aussi un boulot et une famille 👨‍👩‍👧‍👦 On traite vos demandes dès que possible, merci de votre patience ! Pour toute demande : **ouvre un ticket** 🎫

🛣️ **Déplacements & véhicules**
• Tous les déplacements, dans les champs comme sur la route, doivent être **le plus réalistes possible** (pas de rallye en moissonneuse 😅)
• Utilise des véhicules adaptés, dans tes champs comme sur les voies de circulation
• Un achat ? Tu le récupères tout de suite chez le concessionnaire
• Tes véhicules dorment à ton exploitation
• Matériel gênant ou abandonné = il peut disparaître 🪄

🗺️ **Respect de la map**
• Interdit de modifier la map d'origine : **destruction de bâtiments, de props, de routes ou de sentiers** ❌
• Terraforming et peinture : uniquement dans tes champs vierges, si c'est réaliste, et jamais aux abords des routes ✅
• L'utilisation des **spots de stade** est interdite 🚫
• Une modification à faire ? Demande-la par ticket 🎫

🏡 **Ton exploitation**
• Propre, rangée et cohérente avec tes activités
• Tu construis uniquement sur tes terrains
• Chaque exploitation gère son propre porte-monnaie 💰

🚀 **Départ**
• Le terrain de départ est payé grâce à un **crédit généré par l'association**, à **rembourser au fur et à mesure** 🏦
• Aucun bâtiment n'est placé à l'avance 🏗️
• Tous les joueurs démarrent **au même niveau** ⚖️

🌾 **Activités & travaux**
• Tu choisis tes activités dans la liste officielle (rôle Discord)
• Tu produis et vends seulement ce qui correspond à tes activités
• **Respecte la liste des travaux autorisés** : elle indique ce que tu peux faire ou non sur ton exploitation
• Un travail interdit pour toi ? Fais appel à un joueur qui a le droit (facture 🧾)
• Envie de changer ou d'ajouter une activité ? Ouvre un ticket 🎫`,

`📏 **Limites**
• 🌱 10 champs max ~
• 🐝 5 ruches max
• 🏠 8 serres max
• 🐄 1 enclos par espèce, **500 animaux max par enclos**
• 🏭 Usines : selon ton niveau d'industrie
• 🌾 Fusion des champs : **interdite** 🚫

🏭 **Usines**
• Adaptées à ton niveau d'industrie, sur ton exploitation
• Autorisée seulement si tu produis au moins un ingrédient majeur de la recette (ex : vaches laitières → laiterie)
• L'eau ne compte pas comme ingrédient 💧

🧹 **Propreté**
• Ne laisse aucune ressource éparpillée sur la carte hors de ton exploitation : balles, balles enrubannées, tas de cailloux, d'herbe…
• Nettoie tes parcelles et ton exploitation, pour les performances du serveur
• Balles et palettes se rangent dans un lieu de stockage adapté : rien ne traîne éternellement

💶 **Ventes**
• Pas de vente directe : usines réglées sur « Stocker »
• Tout se vend en livrant au point de vente, animaux compris (en bétaillère 🐖)

🤝 **Entre joueurs**
• Balles, palettes, matériel : uniquement via la plateforme plaçable
• Argent : uniquement par facture 🧾
• Tout échange doit être accepté par les deux joueurs
• Synchro ? Annonce-la en vocal ou par écrit

💚 **Partage & entraide**
• Même si tu as le monopole d'une activité, partage-la avec les autres exploitations : on joue ensemble !`,

`🚜 **En jeu**
• 👷 **1 ouvrier (IA)** autorisé à la fois
• 📋 Contrats PNJ : tous les contrats disponibles sont autorisés
• 🔒 Interdit d'utiliser le matériel, les silos ou les champs d'un autre joueur sans son accord
• 🗺️ Achat de terrains libre, **sauf** les terrains qui touchent directement les limites d'une autre exploitation
• 🏦 Prêt bancaire : **350 000 € maximum**
• 🐄 Animaux : nourris et soignés, aucun enclos laissé à l'abandon
• 💶 Prix entre joueurs : tarifs raisonnables. Un doute ? Pose la question dans le chat

🐞 **Bugs & pertes**
• Ouvre un ticket **avec tous les détails** (quoi, quand, où, captures)
• Pas de détails = pas de remboursement 🙅

💤 **Inactivité & départ**
• **10 jours** d'absence sans prévenir = ferme considérée inactive
• En cas de départ, la ferme est vendue au joueur suivant et adaptée à sa façon de jouer

⚠️ **Sanctions**
1️⃣ Avertissement
2️⃣ Amende
3️⃣ Retrait de ton statut de gérant

⚖️ **Un souci ?**
Ouvre un ticket, le staff s'en occupe.`,
];

module.exports = { BLOCS };
