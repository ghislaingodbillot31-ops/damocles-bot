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

// Activité 1 au choix (cultures, vignes, vergers, serres) + Activité 2 au choix (élevage). La forêt est à part.
// groupe : regroupement d'affichage dans le panneau · type : 1 ou 2 = liste dans laquelle l'exploitation choisit · choisir:false = non sélectionnable
const CER = [...T1, 'Broyage', 'Semis classique', 'Semis direct', ...ENGRAIS, 'Moisson'];
const MARA = [...T1, 'Broyage', 'Semis classique', 'Plantation', ...ENGRAIS, 'Binage / désherbage', 'Récolte de légumes'];
const TROP = [...T1, 'Broyage', 'Semis classique', 'Plantation', ...ENGRAIS, 'Récolte coton / canne'];
const FOUR = ['Préparation superficielle', 'Roulage', 'Épierrage', 'Semis direct', ...ENGRAIS];
const ACTIVITES = [
  { value: 'cereales1', emoji: '🌾', nom: 'Céréalier 1', groupe: 'cereales', type: 1, works: CER },
  { value: 'cereales2', emoji: '🌻', nom: 'Céréalier 2', groupe: 'cereales', type: 1, works: CER },
  { value: 'maraicher1', emoji: '🥕', nom: 'Maraîcher 1', groupe: 'maraicher', type: 1, works: MARA },
  { value: 'maraicher2', emoji: '🥬', nom: 'Maraîcher 2', groupe: 'maraicher', type: 1, works: MARA },
  { value: 'tropical1', emoji: '🌴', nom: 'Tropical 1', groupe: 'tropical', type: 1, works: TROP },
  { value: 'tropical2', emoji: '☁️', nom: 'Tropical 2', groupe: 'tropical', type: 1, works: TROP },
  { value: 'riz', emoji: '🍚', nom: 'Riziculteur', groupe: 'riz', type: 1, works: ['Préparation superficielle', 'Roulage', 'Préparation de rizière', 'Semis classique', ...ENGRAIS, 'Moisson'] },
  { value: 'fourrager1', emoji: '🌿', nom: 'Fourrager + Ensileur 1', groupe: 'fourrager', type: 1, works: [...FOUR, 'Fourrage (fauchage, fanage, andainage)', 'Bottelage', 'Enrubannage'] },
  { value: 'fourrager2', emoji: '🌽', nom: 'Fourrager + Ensileur 2', groupe: 'fourrager', type: 1, works: [...FOUR, 'Fourrage (fauchage, fanage, andainage)', 'Enrubannage', 'Ensilage / autochargeuse'] },
  { value: 'vigne', emoji: '🍇', nom: 'Viticulteur', groupe: 'vigne', type: 1, works: ['Plantation', ...RANGS, 'Vendange', 'Pressage'] },
  { value: 'olives', emoji: '🫒', nom: 'Oléiculteur', groupe: 'olives', type: 1, works: ['Plantation', ...RANGS, 'Récolte des olives', 'Pressage'] },
  { value: 'serre1', emoji: '🍅', nom: 'Culture sous serre 1', groupe: 'serre', type: 1, works: ['Gestion des serres · Gestion de la champignonnière'] },
  { value: 'serre2', emoji: '🍄', nom: 'Culture sous serre 2', groupe: 'serre', type: 1, works: ['Gestion des serres · Gestion de la champignonnière'] },
  { value: 'buffles', emoji: '🐃', nom: 'Buffles + vaches laitières', groupe: 'elevage', type: 2, works: ELEVAGE },
  { value: 'viande', emoji: '🥩', nom: 'Vaches à viande', groupe: 'elevage', type: 2, works: ELEVAGE },
  { value: 'ovins', emoji: '🐑', nom: 'Moutons + chèvres', groupe: 'elevage', type: 2, works: ELEVAGE },
  { value: 'porcs', emoji: '🐖', nom: 'Porcs', groupe: 'elevage', type: 2, works: ELEVAGE },
  { value: 'equin', emoji: '🐎', nom: 'Équin + abeilles', groupe: 'elevage', type: 2, works: [...ELEVAGE, 'Monte des chevaux', 'Pose des ruches'] },
  { value: 'poules', emoji: '🐔', nom: 'Poules', groupe: 'elevage', type: 2, works: ELEVAGE },
  { value: 'foret', emoji: '🌲', nom: 'Association forestière', groupe: 'foret', choisir: false, works: ['Forêt (abattage, débardage, fendage, plaquettes)'] },
];

// Chaque élevage séparément : proposés à l'achat comme activité supplémentaire
const ELEVAGE_INDIV = [
  { emoji: '🐃', nom: 'Buffles', works: ELEVAGE }, { emoji: '🐄', nom: 'Vaches laitières', works: ELEVAGE },
  { emoji: '🥩', nom: 'Vaches à viande', works: ELEVAGE }, { emoji: '🐑', nom: 'Moutons', works: ELEVAGE },
  { emoji: '🐐', nom: 'Chèvres', works: ELEVAGE }, { emoji: '🐖', nom: 'Porcs', works: ELEVAGE },
  { emoji: '🐔', nom: 'Poules', works: ELEVAGE }, { emoji: '🐎', nom: 'Chevaux', works: [...ELEVAGE, 'Monte des chevaux'] },
  { emoji: '🐝', nom: 'Abeilles', works: ['Pose des ruches'] },
].map(a => ({ ...a, groupe: 'elevage' }));

// Anciens noms déjà enregistrés dans les fiches d'exploitation : plus proposés, mais leurs droits restent reconnus
const ANCIENS = [
  { nom: 'Céréalier + Oléagineux', works: CER }, { nom: 'Maraîcher racines + verts', works: MARA }, { nom: 'Tropical', works: TROP },
  { nom: 'Fourrager + Ensileur', works: [...FOUR, 'Fourrage (fauchage, fanage, andainage)', 'Bottelage', 'Enrubannage', 'Ensilage / autochargeuse'] },
  { nom: 'Culture sous serre', works: ['Gestion des serres · Gestion de la champignonnière'] },
];

const COMMUN = '🔓 **Commun à tous** : Gestion des usines · Transport · Livraison · Manutention · Contrats · Réparation · Construction';

// Activités que l'exploitation peut choisir (menu de gestion)
const CHOIX = ACTIVITES.filter(a => a.choisir !== false);
const parNom = nom => ACTIVITES.find(a => a.nom === nom) || ELEVAGE_INDIV.find(a => a.nom === nom) || ANCIENS.find(a => a.nom === nom);
// Menu d'une case : principale = activité 1 (cultures), secondaire = activité 2 (élevage), supplémentaire = les deux
// Élevage : une espèce par entrée (ELEVAGE_INDIV), plus les anciens regroupements
const choixPour = champ => [...CHOIX.filter(a => a.type === 1), ...ELEVAGE_INDIV].filter(a => champ === 'supplementaire' || (a.type === 1) === (champ !== 'secondaire')).map(a => ({ label: a.emoji + ' ' + a.nom, value: a.nom }));

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
  const choisies = [exploit.activitePrincipale, exploit.activiteSecondaire, ...(exploit.activitesSup || []), exploit.activiteSupplementaire].map(n => n && parNom(n)).filter(Boolean).map(a => ({ emoji: '🌱', ...a }));
  const permis = new Set(choisies.flatMap(a => a.works));
  const SEP = '━━━━━━━━━━━━━━';
  // même liste que « Mes droits » : • remplacé par ✅ (autorisé) ou ❌ (interdit) selon les activités choisies
  const lignes = ['**📋 LISTE DES TRAVAUX — FS25**', SEP,
    choisies.length ? '**Activités :** ' + choisies.map(a => a.emoji + ' ' + a.nom).join(' · ') : '**Aucune activité choisie** : va dans **⚙️ Gérer mon exploitation** pour les choisir.',
    ...LISTE.map(w => (permis.has(w) ? '✅ ' : '❌ ') + w), SEP, COMMUN];
  return [{ description: lignes.join('\n'), color: exploit.couleur ?? 0x2ECC71 }];
}

module.exports = { payload, panneauDroits, CHOIX, ELEVAGE_INDIV, choixPour, parNom };
