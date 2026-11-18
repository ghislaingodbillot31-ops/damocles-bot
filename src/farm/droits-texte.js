// Sous-menu « Mes droits » (menu Exploitation) : une entrée par activité, le choix affiche ses travaux autorisés
const TERRE = 'Préparation superficielle · Roulage · ';
const ENGRAIS = 'Engrais solide · Chaulage · Engrais liquide · Herbicide · Épandage fumier / lisier';
const ELEVAGE = 'Alimentation · Mélange de ration · Paillage · Nettoyage des bâtiments · Stockage fumier / lisier · Transport en bétaillère';

const ACTIVITES = [
  { value: 'cereales', emoji: '🌾', nom: 'Céréalier + Oléagineux', droits: 'Labour · Déchaumage · Préparation superficielle · Sous-solage · Roulage · Épierrage · Semis classique · Semis direct · ' + ENGRAIS + ' · Moisson · Broyage' },
  { value: 'maraicher', emoji: '🥕', nom: 'Maraîcher racines + verts', droits: 'Labour · Déchaumage · Préparation superficielle · Sous-solage · Roulage · Épierrage · Semis classique · Plantation de légumes · Engrais solide · Chaulage · Engrais liquide · Herbicide · Binage / désherbage · Épandage fumier / lisier · Récolte de racines · Récolte de légumes verts · Broyage' },
  { value: 'tropical', emoji: '🌴', nom: 'Tropical', droits: 'Labour · Déchaumage · Préparation superficielle · Sous-solage · Roulage · Épierrage · Semis classique · Plantation de canne · ' + ENGRAIS + ' · Récolte du coton · Récolte de la canne · Broyage' },
  { value: 'riz', emoji: '🍚', nom: 'Riziculteur', droits: TERRE + 'Préparation de rizière · Semis du riz · ' + ENGRAIS + ' · Moisson' },
  { value: 'fourrager', emoji: '🌿', nom: 'Fourrager + Ensileur', droits: TERRE + 'Épierrage · Semis direct · ' + ENGRAIS + ' · Fauchage · Fanage · Andainage · Bottelage · Enrubannage · Autochargeuse · Ensilage' },
  { value: 'vigne', emoji: '🍇', nom: 'Viticulteur', droits: 'Plantation de vignes · Engrais solide · Engrais liquide · Herbicide · Binage / désherbage · Entretien des rangs · Taille / broyage entre les rangs · Vendange · Pressage du raisin' },
  { value: 'olives', emoji: '🫒', nom: 'Oléiculteur', droits: 'Plantation d\'oliviers · Engrais solide · Engrais liquide · Herbicide · Binage / désherbage · Entretien des rangs · Taille / broyage entre les rangs · Récolte des olives · Pressage des olives' },
  { value: 'serre', emoji: '🍅', nom: 'Culture sous serre', droits: 'Gestion des serres · Gestion de la champignonnière' },
  { value: 'elevage', emoji: '🐾', nom: 'Élevages', intro: '🐃 Buffles + vaches laitières · 🥩 Vaches à viande · 🐑 Moutons + chèvres · 🐖 Porcs + poules · 🐎 Équin + abeilles\n', droits: ELEVAGE + '\n🐎 Équin + abeilles : en plus, Monte des chevaux · Pose des ruches' },
  { value: 'foret', emoji: '🌲', nom: 'Association forestière', droits: 'Plantation d\'arbres · Abattage · Débardage · Fendage · Broyage en plaquettes' },
];

const COMMUN = '🔓 **Ouvert à tous** : Gestion des usines · Transport · Livraison au point de vente · Manutention · Contrats / prestations · Réparation · Construction\n❌ Tout ce qui n\'est pas listé est interdit pour l\'activité';

const texte = value => {
  const a = ACTIVITES.find(x => x.value === value);
  return a ? '**📜 MES DROITS — ' + a.emoji + ' ' + a.nom + '**\n━━━━━━━━━━━━━━\n' + (a.intro || '') + '✅ ' + a.droits + '\n━━━━━━━━━━━━━━\n' + COMMUN
    : '**📜 MES DROITS**\nChoisis une activité dans le menu pour voir les travaux autorisés.\n━━━━━━━━━━━━━━\n' + COMMUN;
};

// Message du sous-menu : menu déroulant des activités + texte de l'activité choisie
const payload = value => ({
  embeds: [{ description: texte(value), color: 0x2ECC71 }],
  components: [{ type: 1, components: [{ type: 3, custom_id: 'hub_expl_droits', placeholder: '📜 Choisis une activité',
    options: ACTIVITES.map(a => ({ label: a.nom, value: a.value, emoji: { name: a.emoji }, default: a.value === value })) }] }],
});

module.exports = { payload };
