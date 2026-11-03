/**
 * Liste des succès FS25 — à modifier librement.
 *
 * Chaque série a 50 niveaux (tiers). Un niveau atteint = un succès débloqué.
 *
 * source :
 *   { stat: 'plowedHectares' }              -> statistique de la ferme (menu Statistiques du jeu)
 *   { sold: ['MILK', 'GOATMILK'] }          -> quantité vendue de ces produits
 *   { sold: '*' }                           -> quantité vendue, tous produits confondus
 *   { produced: ['WOOL'] }                  -> quantité produite par les animaux
 *
 * Les noms de stats inconnus du jeu sont simplement ignorés (la série n'apparaît pas).
 * Au démarrage, le bot affiche dans ses logs la liste des stats disponibles.
 */

// =================== NIVEAUX ===================
// Toutes les séries ont NB_NIVEAUX niveaux, du plus petit jusqu'au maximum indiqué.
const NB_NIVEAUX = 50;

/**
 * Niveaux en courbe douce : niveau i = max x (i / nb)^COURBE, arrondi.
 * Les écarts grandissent progressivement mais restent raisonnables en haut
 * (contrairement au x2 où le dernier écart vaut la moitié du maximum).
 */
const COURBE = 2;
function niveaux(max, nb) {
  const out = [];
  for (let i = 1; i <= nb; i += 1) {
    const v = max * (i / nb) ** COURBE;
    // arrondi fin pour garder des écarts réguliers
    const step = v < 50 ? 1 : v < 200 ? 5 : v < 1000 ? 10 : 10 ** (Math.floor(Math.log10(v)) - 2) * 5; // ~3 chiffres
    let r = Math.max(1, Math.round(v / step) * step);
    if (out.length && r <= out[out.length - 1]) r = out[out.length - 1] + 1;
    out.push(r);
  }
  out[out.length - 1] = max;
  return out;
}

// ---- Maximum (niveau 50) de chaque série : à ajuster librement ----
const HA_FIELD      = niveaux(10000, NB_NIVEAUX);      // travaux des champs (ha)
const HA_TOTAL      = niveaux(50000, NB_NIVEAUX);      // total des hectares travaillés
const BALES         = niveaux(10000, NB_NIVEAUX);      // bottes pressées / enrubannées
const CONTRACTS     = niveaux(1000, NB_NIVEAUX);       // contrats
const DISTANCE      = niveaux(20000, NB_NIVEAUX);      // km parcourus
const TREES         = niveaux(5000, NB_NIVEAUX);       // arbres plantés / coupés
const DOG           = niveaux(1000, NB_NIVEAUX);       // caresses au chien
const LITERS_ANIMAL = niveaux(5000000, NB_NIVEAUX);    // lait (L)
const SMALL_ANIMAL  = niveaux(200000, NB_NIVEAUX);     // laine (L), œufs
const MANURE        = niveaux(10000000, NB_NIVEAUX);   // fumier + lisier (L)
const LITERS_CROP   = niveaux(20000000, NB_NIVEAUX);   // ventes de cultures (L)
const SOLD_TOTAL    = niveaux(100000000, NB_NIVEAUX);  // tout vendu (L)

module.exports = [
  // ---------------- Travaux des champs ----------------
  { id: 'labour',       category: '🚜 Travaux des champs', emoji: '🚜', name: 'Laboureur',     source: { stat: 'plowedHectares' },     unit: 'ha', tiers: HA_FIELD },
  { id: 'dechaumage',   category: '🚜 Travaux des champs', emoji: '⚙️', name: 'Déchaumeur',    source: { stat: 'cultivatedHectares' }, unit: 'ha', tiers: HA_FIELD },
  { id: 'semis',        category: '🚜 Travaux des champs', emoji: '🌱', name: 'Semeur',        source: { stat: 'sownHectares' },       unit: 'ha', tiers: HA_FIELD },
  { id: 'fertilisation',category: '🚜 Travaux des champs', emoji: '💧', name: 'Pulvérisateur', source: { stat: 'sprayedHectares' },    unit: 'ha', tiers: HA_FIELD },
  { id: 'desherbage',   category: '🚜 Travaux des champs', emoji: '🌿', name: 'Désherbeur',    source: { stat: 'weededHectares' },     unit: 'ha', tiers: HA_FIELD },
  { id: 'fauche',       category: '🚜 Travaux des champs', emoji: '🌾', name: 'Faucheur',      source: { stat: 'mowedHectares' },      unit: 'ha', tiers: HA_FIELD },
  { id: 'moisson',      category: '🚜 Travaux des champs', emoji: '🌾', name: 'Moissonneur',   source: { stat: 'threshedHectares' },   unit: 'ha', tiers: HA_FIELD },
  { id: 'travail',      category: '🚜 Travaux des champs', emoji: '🧑‍🌾', name: 'Bourreau de travail', source: { stat: 'workedHectares' }, unit: 'ha', tiers: HA_TOTAL },

  // ---------------- Fourrage ----------------
  { id: 'bottes',       category: '🎯 Fourrage & divers', emoji: '🟫', name: 'Botteleur',     source: { stat: 'baleCount' },          unit: 'bottes', tiers: BALES },
  { id: 'enrubannage',  category: '🎯 Fourrage & divers', emoji: '⚪', name: 'Enrubanneur',   source: { stat: 'wrappedBales' },       unit: 'bottes', tiers: BALES },
  { id: 'missions',     category: '🎯 Fourrage & divers', emoji: '📋', name: 'Prestataire',   source: { stat: 'missionCount' },       unit: 'contrats', tiers: CONTRACTS },
  { id: 'distance',     category: '🎯 Fourrage & divers', emoji: '🛣️', name: 'Routier',       source: { stat: 'traveledDistance' },   unit: 'km', tiers: DISTANCE },
  { id: 'plantation',   category: '🎯 Fourrage & divers', emoji: '🌳', name: 'Planteur',      source: { stat: 'plantedTreeCount' },   unit: 'arbres', tiers: TREES },
  { id: 'bucheron',     category: '🎯 Fourrage & divers', emoji: '🪓', name: 'Bûcheron',      source: { stat: 'cutTreeCount' },       unit: 'arbres', tiers: TREES },
  { id: 'chien',        category: '🎯 Fourrage & divers', emoji: '🐕', name: 'Ami des chiens', source: { stat: 'petDogCount' },       unit: 'caresses', tiers: DOG },

  // ---------------- Élevage (production) ----------------
  { id: 'prod_lait',    category: '🐄 Élevage', emoji: '🥛', name: 'Producteur laitier', source: { produced: ['MILK', 'GOATMILK', 'BUFFALOMILK'] }, unit: 'L', tiers: LITERS_ANIMAL },
  { id: 'prod_laine',   category: '🐄 Élevage', emoji: '🐑', name: 'Tondeur',            source: { produced: ['WOOL'] },  unit: 'L', tiers: SMALL_ANIMAL },
  { id: 'prod_oeufs',   category: '🐄 Élevage', emoji: '🥚', name: 'Aviculteur',         source: { produced: ['EGG'] },   unit: 'œufs', tiers: SMALL_ANIMAL },
  { id: 'prod_fumier',  category: '🐄 Élevage', emoji: '💩', name: 'Roi du fumier',      source: { produced: ['MANURE', 'LIQUIDMANURE'] }, unit: 'L', tiers: MANURE },

  // ---------------- Ventes ----------------
  { id: 'vente_lait',   category: '💰 Ventes', emoji: '🥛', name: 'Laitier',            source: { sold: ['MILK', 'GOATMILK', 'BUFFALOMILK'] }, unit: 'L', tiers: LITERS_ANIMAL },
  { id: 'vente_laine',  category: '💰 Ventes', emoji: '🧶', name: 'Lainier',            source: { sold: ['WOOL'] }, unit: 'L', tiers: SMALL_ANIMAL },
  { id: 'vente_oeufs',  category: '💰 Ventes', emoji: '🥚', name: 'Coquetier',          source: { sold: ['EGG'] }, unit: 'œufs', tiers: SMALL_ANIMAL },
  { id: 'vente_cereales', category: '💰 Ventes', emoji: '🌾', name: 'Céréalier',        source: { sold: ['WHEAT', 'BARLEY', 'OAT', 'SORGHUM', 'RICE', 'RICELONGGRAIN'] }, unit: 'L', tiers: LITERS_CROP },
  { id: 'vente_oleagineux', category: '💰 Ventes', emoji: '🌻', name: 'Roi des oléagineux',    source: { sold: ['CANOLA', 'SUNFLOWER', 'SOYBEAN'] }, unit: 'L', tiers: LITERS_CROP },
  { id: 'vente_mais',   category: '💰 Ventes', emoji: '🌽', name: 'Maïsiculteur',       source: { sold: ['MAIZE'] }, unit: 'L', tiers: LITERS_CROP },
  { id: 'vente_racines',category: '💰 Ventes', emoji: '🥔', name: 'Arracheur',          source: { sold: ['POTATO', 'SUGARBEET', 'SUGARBEET_CUT', 'CARROT', 'PARSNIP', 'BEETROOT'] }, unit: 'L', tiers: LITERS_CROP },
  { id: 'vente_fourrage', category: '💰 Ventes', emoji: '🌿', name: 'Marchand de foin', source: { sold: ['HAY', 'STRAW', 'SILAGE', 'GRASS_WINDROW', 'DRYGRASS_WINDROW'] }, unit: 'L', tiers: LITERS_CROP },
  { id: 'vente_total',  category: '💰 Ventes', emoji: '🏪', name: 'Grand négociant',    source: { sold: '*' }, unit: 'L', tiers: SOLD_TOTAL },
];
