// Activités du serveur et travaux autorisés (menu « Mes droits », choix d'activité, panneau du salon privé)
const T1 = ['Labour', 'Déchaumage', 'Sous-solage', 'Préparation superficielle', 'Roulage', 'Épierrage'];
const ENGRAIS = ['Engrais solide', 'Engrais liquide', 'Chaulage', 'Herbicide', 'Épandage fumier / lisier'];
const RANGS = ['Engrais solide', 'Engrais liquide', 'Herbicide', 'Binage / désherbage', 'Entretien des rangs', 'Broyage'];
const ELEVAGE = ['Soins & alimentation des animaux', 'Paillage', 'Transport en bétaillère'];

// Liste complète des travaux du serveur (affichée par « Mes droits »)
const LISTE = [
  'Labour', 'Déchaumage', 'Sous-solage', 'Préparation superficielle', 'Roulage', 'Épierrage', 'Broyage', 'Semis classique', 'Semis direct', 'Plantation',
  'Engrais solide', 'Engrais liquide', 'Chaulage', 'Herbicide', 'Binage / désherbage', 'Épandage fumier / lisier', 'Moisson', 'Récolte de légumes',
  'Récolte coton / canne', 'Préparation de rizière', 'Fourrage (fauchage, fanage, andainage)', 'Bottelage', 'Enrubannage', 'Ensilage / autochargeuse',
  'Entretien des rangs', 'Vendange', 'Récolte des olives', 'Pressage', 'Gestion des serres · Gestion de la champignonnière', 'Soins & alimentation des animaux',
  'Paillage', 'Transport en bétaillère', 'Monte des chevaux', 'Pose des ruches', 'Forêt (abattage, débardage, fendage, plaquettes)',
];

// groupe : regroupement d'affichage dans le panneau · choisir:false = non sélectionnable par une exploitation
const ACTIVITES = [
  { value: 'cereales', emoji: '🌾', nom: 'Céréalier + Oléagineux', groupe: 'cereales', works: [...T1, 'Broyage', 'Semis classique', 'Semis direct', ...ENGRAIS, 'Moisson'] },
  { value: 'maraicher', emoji: '🥕', nom: 'Maraîcher racines + verts', groupe: 'maraicher', works: [...T1, 'Broyage', 'Semis classique', 'Plantation', ...ENGRAIS, 'Binage / désherbage', 'Récolte de légumes'] },
  { value: 'tropical', emoji: '🌴', nom: 'Tropical', groupe: 'tropical', works: [...T1, 'Broyage', 'Semis classique', 'Plantation', ...ENGRAIS, 'Récolte coton / canne'] },
  { value: 'riz', emoji: '🍚', nom: 'Riziculteur', groupe: 'riz', works: ['Préparation superficielle', 'Roulage', 'Préparation de rizière', 'Semis classique', ...ENGRAIS, 'Moisson'] },
  { value: 'fourrager', emoji: '🌿', nom: 'Fourrager + Ensileur', groupe: 'fourrager', works: ['Préparation superficielle', 'Roulage', 'Épierrage', 'Semis direct', ...ENGRAIS, 'Fourrage (fauchage, fanage, andainage)', 'Bottelage', 'Enrubannage', 'Ensilage / autochargeuse'] },
  { value: 'vigne', emoji: '🍇', nom: 'Viticulteur', groupe: 'vigne', works: ['Plantation', ...RANGS, 'Vendange', 'Pressage'] },
  { value: 'olives', emoji: '🫒', nom: 'Oléiculteur', groupe: 'olives', works: ['Plantation', ...RANGS, 'Récolte des olives', 'Pressage'] },
  { value: 'serre', emoji: '🍅', nom: 'Culture sous serre', groupe: 'serre', works: ['Gestion des serres · Gestion de la champignonnière'] },
  { value: 'buffles', emoji: '🐃', nom: 'Buffles + vaches laitières', groupe: 'elevage', works: ELEVAGE },
  { value: 'viande', emoji: '🥩', nom: 'Vaches à viande', groupe: 'elevage', works: ELEVAGE },
  { value: 'ovins', emoji: '🐑', nom: 'Moutons + chèvres', groupe: 'elevage', works: ELEVAGE },
  { value: 'porcs', emoji: '🐖', nom: 'Porcs + poules', groupe: 'elevage', works: ELEVAGE },
  { value: 'equin', emoji: '🐎', nom: 'Équin + abeilles', groupe: 'elevage', works: [...ELEVAGE, 'Monte des chevaux', 'Pose des ruches'] },
  { value: 'foret', emoji: '🌲', nom: 'Association forestière', groupe: 'foret', choisir: false, works: ['Forêt (abattage, débardage, fendage, plaquettes)'] },
];

const COMMUN = '🔓 **Commun à tous** : Gestion des usines · Transport · Livraison · Manutention · Contrats · Réparation · Construction';

// Activités que l'exploitation peut choisir (menu de gestion)
const CHOIX = ACTIVITES.filter(a => a.choisir !== false);
const parNom = nom => ACTIVITES.find(a => a.nom === nom);

// ── Sous-menu « Mes droits » (information) ───────────────────────────────────
const texte = value => {
  const a = ACTIVITES.find(x => x.value === value);
  return a ? '**📜 MES DROITS — ' + a.emoji + ' ' + a.nom + '**\n━━━━━━━━━━━━━━\n✅ ' + a.works.join(' · ') + '\n━━━━━━━━━━━━━━\n' + COMMUN
    : ['**📋 LISTE DES TRAVAUX — FS25**', '━━━━━━━━━━━━━━', ...LISTE.map(w => '• ' + w), '━━━━━━━━━━━━━━', COMMUN, '', '_Choisis une activité dans le menu pour voir ses travaux autorisés._'].join('\n');
};

const payload = value => ({
  embeds: [{ description: texte(value), color: 0x2ECC71 }],
  components: [{ type: 1, components: [{ type: 3, custom_id: 'hub_expl_droits', placeholder: '📜 Choisis une activité',
    options: ACTIVITES.map(a => ({ label: a.nom, value: a.value, emoji: { name: a.emoji }, default: a.value === value })) }] }],
});

// ── Panneau du salon privé : ✅ / ❌ selon les activités choisies par l'exploitation ──
function panneauDroits(exploit) {
  const choisies = [exploit.activitePrincipale, exploit.activiteSecondaire, exploit.activiteSupplementaire].map(n => n && parNom(n)).filter(Boolean);
  const permis = new Set(choisies.flatMap(a => a.works));
  const SEP = '━━━━━━━━━━━━━━';
  // même liste que « Mes droits » : • remplacé par ✅ (autorisé) ou ❌ (interdit) selon les activités choisies
  const lignes = ['**📋 LISTE DES TRAVAUX — FS25**', SEP,
    choisies.length ? '**Activités :** ' + choisies.map(a => a.emoji + ' ' + a.nom).join(' · ') : '**Aucune activité choisie** : va dans **⚙️ Gérer mon exploitation** pour les choisir.',
    ...LISTE.map(w => (permis.has(w) ? '✅ ' : '❌ ') + w), SEP, COMMUN];
  return [{ description: lignes.join('\n'), color: exploit.couleur ?? 0x2ECC71 }];
}

module.exports = { payload, panneauDroits, CHOIX };
