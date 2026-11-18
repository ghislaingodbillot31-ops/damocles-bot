// Activités du serveur et travaux autorisés (menu « Mes droits », choix d'activité, panneau du salon privé)
const T1 = ['Labour', 'Déchaumage', 'Préparation superficielle', 'Sous-solage', 'Roulage', 'Épierrage'];
const ENGRAIS = ['Engrais solide', 'Chaulage', 'Engrais liquide', 'Herbicide', 'Épandage fumier / lisier'];
const RANGS = ['Engrais solide', 'Engrais liquide', 'Herbicide', 'Binage / désherbage', 'Entretien des rangs', 'Taille / broyage entre les rangs'];
const ELEVAGE = ['Alimentation', 'Mélange de ration', 'Paillage', 'Nettoyage des bâtiments', 'Stockage fumier / lisier', 'Transport en bétaillère'];

// groupe : regroupement d'affichage dans le panneau · choisir:false = non sélectionnable par une exploitation
const ACTIVITES = [
  { value: 'cereales', emoji: '🌾', nom: 'Céréalier + Oléagineux', groupe: 'cereales', works: [...T1, 'Semis classique', 'Semis direct', ...ENGRAIS, 'Moisson', 'Broyage'] },
  { value: 'maraicher', emoji: '🥕', nom: 'Maraîcher racines + verts', groupe: 'maraicher', works: [...T1, 'Semis classique', 'Plantation de légumes', ...ENGRAIS, 'Binage / désherbage', 'Récolte de racines', 'Récolte de légumes verts', 'Broyage'] },
  { value: 'tropical', emoji: '🌴', nom: 'Tropical', groupe: 'tropical', works: [...T1, 'Semis classique', 'Plantation de canne', ...ENGRAIS, 'Récolte du coton', 'Récolte de la canne', 'Broyage'] },
  { value: 'riz', emoji: '🍚', nom: 'Riziculteur', groupe: 'riz', works: ['Préparation superficielle', 'Roulage', 'Préparation de rizière', 'Semis du riz', ...ENGRAIS, 'Moisson'] },
  { value: 'fourrager', emoji: '🌿', nom: 'Fourrager + Ensileur', groupe: 'fourrager', works: ['Préparation superficielle', 'Roulage', 'Épierrage', 'Semis direct', ...ENGRAIS, 'Fauchage', 'Fanage', 'Andainage', 'Bottelage', 'Enrubannage', 'Autochargeuse', 'Ensilage'] },
  { value: 'vigne', emoji: '🍇', nom: 'Viticulteur', groupe: 'vigne', works: ['Plantation de vignes', ...RANGS, 'Vendange', 'Pressage du raisin'] },
  { value: 'olives', emoji: '🫒', nom: 'Oléiculteur', groupe: 'olives', works: ['Plantation d\'oliviers', ...RANGS, 'Récolte des olives', 'Pressage des olives'] },
  { value: 'serre', emoji: '🍅', nom: 'Culture sous serre', groupe: 'serre', works: ['Gestion des serres', 'Gestion de la champignonnière'] },
  { value: 'buffles', emoji: '🐃', nom: 'Buffles + vaches laitières', groupe: 'elevage', works: ELEVAGE },
  { value: 'viande', emoji: '🥩', nom: 'Vaches à viande', groupe: 'elevage', works: ELEVAGE },
  { value: 'ovins', emoji: '🐑', nom: 'Moutons + chèvres', groupe: 'elevage', works: ELEVAGE },
  { value: 'porcs', emoji: '🐖', nom: 'Porcs + poules', groupe: 'elevage', works: ELEVAGE },
  { value: 'equin', emoji: '🐎', nom: 'Équin + abeilles', groupe: 'elevage', works: [...ELEVAGE, 'Monte des chevaux', 'Pose des ruches'] },
  { value: 'foret', emoji: '🌲', nom: 'Association forestière', groupe: 'foret', choisir: false, works: ['Plantation d\'arbres', 'Abattage', 'Débardage', 'Fendage', 'Broyage en plaquettes'] },
];

const COMMUN = '🔓 **Ouvert à tous** : Gestion des usines · Transport · Livraison au point de vente · Manutention · Contrats / prestations · Réparation · Construction\n❌ Tout ce qui n\'est pas listé est interdit pour l\'activité';

// Activités que l'exploitation peut choisir (menu de gestion)
const CHOIX = ACTIVITES.filter(a => a.choisir !== false);
const parNom = nom => ACTIVITES.find(a => a.nom === nom);

// ── Sous-menu « Mes droits » (information) ───────────────────────────────────
const texte = value => {
  const a = ACTIVITES.find(x => x.value === value);
  return a ? '**📜 MES DROITS — ' + a.emoji + ' ' + a.nom + '**\n━━━━━━━━━━━━━━\n✅ ' + a.works.join(' · ') + '\n━━━━━━━━━━━━━━\n' + COMMUN
    : '**📜 MES DROITS**\nChoisis une activité dans le menu pour voir les travaux autorisés.\n━━━━━━━━━━━━━━\n' + COMMUN;
};

const payload = value => ({
  embeds: [{ description: texte(value), color: 0x2ECC71 }],
  components: [{ type: 1, components: [{ type: 3, custom_id: 'hub_expl_droits', placeholder: '📜 Choisis une activité',
    options: ACTIVITES.map(a => ({ label: a.nom, value: a.value, emoji: { name: a.emoji }, default: a.value === value })) }] }],
});

// ── Panneau du salon privé : ✅ / ❌ selon les activités choisies par l'exploitation ──
const GROUPES = ['cereales', 'maraicher', 'tropical', 'riz', 'fourrager', 'vigne', 'olives', 'serre', 'elevage'];
function panneauDroits(exploit) {
  const choisies = [exploit.activitePrincipale, exploit.activiteSecondaire, exploit.activiteSupplementaire].map(n => n && parNom(n)).filter(Boolean);
  const permis = new Set(choisies.flatMap(a => a.works));
  const lignes = [
    choisies.length ? '**Activités :** ' + choisies.map(a => a.emoji + ' ' + a.nom).join(' · ') : '**Aucune activité choisie** : va dans **⚙️ Gérer mon exploitation** pour les choisir.',
    '✅ = autorisé · ❌ = interdit',
  ];
  // une colonne par activité (champs côte à côte, un travail par ligne) : alignement identique pour tout le monde
  const fields = GROUPES.map(g => {
    const membres = ACTIVITES.filter(a => a.groupe === g);
    const works = [...new Set(membres.flatMap(a => a.works))];
    return { name: g === 'elevage' ? '🐾 Élevages' : membres[0].emoji + ' ' + membres[0].nom, value: works.map(w => (permis.has(w) ? '✅ ' : '❌ ') + w).join('\n'), inline: true };
  });
  fields.push({ name: '​', value: COMMUN, inline: false });
  return [{ title: '🛠️ TRAVAUX AUTORISÉS · ' + exploit.nom, description: lignes.join('\n'), fields, color: exploit.couleur ?? 0x2ECC71 }];
}

module.exports = { payload, panneauDroits, CHOIX };
