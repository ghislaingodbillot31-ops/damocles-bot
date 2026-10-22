// Logique métier de Multifruit (aucun import Discord). Chaque action est une transaction :
// vérifications + écritures sans interruption → pas de double débit, même en cas de double clic.
const { db, transaction } = require('../db/db');
const C = require('./contenu');

class JeuErreur extends Error {}
const ko = msg => { throw new JeuErreur(msg); };
const r2 = n => Math.round(n * 100) / 100;
const EPS = 0.001;

// ── Accès de base ────────────────────────────────────────────────────────────
const un   = (sql, ...p) => db.prepare(sql).get(...p);
const tous = (sql, ...p) => db.prepare(sql).all(...p);
const run  = (sql, ...p) => db.prepare(sql).run(...p);

function entreprise(userId) { return un('SELECT * FROM multifruit_entreprises WHERE discord_user_id = ?', userId) || null; }
function entrepriseOuErreur(userId) { return entreprise(userId) || ko("Tu n'as pas encore d'entreprise : utilise `/creer-entreprise`."); }

function journal(ent, type, detail, montant = 0) {
  run('INSERT INTO multifruit_journal (entreprise_id, date, type, detail, montant) VALUES (?,?,?,?,?)', ent.id, Date.now(), type, detail, montant);
}
function debiter(ent, cout, type, detail) {
  cout = r2(cout);
  const e = un('SELECT pieces FROM multifruit_entreprises WHERE id = ?', ent.id);
  if (e.pieces + EPS < cout) ko(`Fonds insuffisants : il te faut **${cout}** 🪙 (tu as ${r2(e.pieces)}).`);
  run('UPDATE multifruit_entreprises SET pieces = ? WHERE id = ?', r2(e.pieces - cout), ent.id);
  journal(ent, type, detail, -cout);
}
function crediter(ent, gain, type, detail) {
  run('UPDATE multifruit_entreprises SET pieces = pieces + ? WHERE id = ?', r2(gain), ent.id);
  journal(ent, type, detail, gain);
}
// Ajoute delta à une colonne de quantité, en créant la ligne si besoin.
function ajouter(table, cles, colQte, delta) {
  const where = Object.keys(cles).map(k => `${k} = ?`).join(' AND ');
  const vals = Object.values(cles);
  const ex = un(`SELECT ${colQte} AS q FROM ${table} WHERE ${where}`, ...vals);
  if (ex) run(`UPDATE ${table} SET ${colQte} = ? WHERE ${where}`, r2(ex.q + delta), ...vals);
  else run(`INSERT INTO ${table} (${Object.keys(cles).join(',')}, ${colQte}) VALUES (${vals.map(() => '?').join(',')}, ?)`, ...vals, r2(delta));
}

// Compteurs cumulés pour les classements.
const stat = (ent, cle, delta) => ajouter('multifruit_stats', { entreprise_id: ent.id, cle }, 'valeur', delta);

// ── Entreprise ───────────────────────────────────────────────────────────────
function creerEntreprise(userId, nomBrut) {
  const nom = String(nomBrut || '').trim().replace(/\s+/g, ' ');
  const max = C.eq.nom_entreprise_max;
  if (nom.length < 3 || nom.length > max) ko(`Le nom doit faire entre 3 et ${max} caractères.`);
  if (!/^[\p{L}\p{N} '\-.&]+$/u.test(nom)) ko("Le nom ne peut contenir que des lettres, chiffres, espaces et `' - . &`.");
  return transaction(() => {
    if (entreprise(userId)) ko('Tu as déjà une entreprise.');
    if (un('SELECT 1 FROM multifruit_entreprises WHERE nom = ?', nom)) ko("Ce nom d'entreprise est déjà pris.");
    const info = run('INSERT INTO multifruit_entreprises (discord_user_id, nom, pieces, capacite_fruits_kg, date_creation) VALUES (?,?,?,?,?)',
      userId, nom, C.eq.argent_depart, C.eq.stock_fruits_capacite_kg, Date.now());
    const ent = un('SELECT * FROM multifruit_entreprises WHERE id = ?', info.lastInsertRowid);
    const cuve = C.cuves[C.eq.cuve_depart];
    run('INSERT INTO multifruit_cuves (entreprise_id, type_cuve, capacite_l) VALUES (?,?,?)', ent.id, cuve.id, cuve.capacite_l);
    journal(ent, 'creation', nom, C.eq.argent_depart);
    return ent;
  });
}

// ── Rattrapage : règle les lots terminés (aucune tâche de fond) ──────────────
function regler(ent) {
  const finis = tous("SELECT * FROM multifruit_lots WHERE entreprise_id = ? AND statut = 'en_cours' AND fin <= ?", ent.id, Date.now());
  run("UPDATE multifruit_commandes SET statut = 'expiree' WHERE entreprise_id = ? AND statut = 'en_cours' AND echeance <= ?", ent.id, Date.now());
  for (const lot of finis) {
    const s = JSON.parse(lot.sorties);
    if (lot.type === 'pressage') {
      const c = un('SELECT volume_l, reserve_l FROM multifruit_cuves WHERE id = ?', s.cuve_id);
      run('UPDATE multifruit_cuves SET volume_l = ?, reserve_l = ?, jus_id = ? WHERE id = ?',
        r2(c.volume_l + s.litres), Math.max(0, r2(c.reserve_l - s.litres)), s.jus_id, s.cuve_id);
    } else if (lot.type === 'embouteillage') {
      ajouter('multifruit_produits_finis', { entreprise_id: ent.id, jus_id: s.jus_id, contenant_id: s.contenant_id }, 'quantite', s.quantite);
    }
    run("UPDATE multifruit_lots SET statut = 'termine' WHERE id = ?", lot.id);
  }
  return finis.length;
}

// ── Lecture pour l'affichage ─────────────────────────────────────────────────
const jourCourant = () => new Date().toLocaleDateString('sv');

function etat(userId) {
  const base = entrepriseOuErreur(userId);
  return transaction(() => {
    regler(base);
    const ent = un('SELECT * FROM multifruit_entreprises WHERE id = ?', base.id);
    return {
      ent,
      fruits: tous('SELECT * FROM multifruit_stock_fruits WHERE entreprise_id = ? AND kg > 0', ent.id),
      machines: tous('SELECT * FROM multifruit_machines WHERE entreprise_id = ?', ent.id),
      cuves: tous('SELECT * FROM multifruit_cuves WHERE entreprise_id = ? ORDER BY id', ent.id),
      contenants: tous('SELECT * FROM multifruit_stock_contenants WHERE entreprise_id = ? AND quantite > 0', ent.id),
      produits: tous('SELECT * FROM multifruit_produits_finis WHERE entreprise_id = ? AND quantite > 0', ent.id),
      lots: tous("SELECT * FROM multifruit_lots WHERE entreprise_id = ? AND statut = 'en_cours' ORDER BY fin", ent.id),
      commandes: tous("SELECT * FROM multifruit_commandes WHERE entreprise_id = ? AND statut = 'en_cours' ORDER BY echeance", ent.id),
      kgFruits: un('SELECT COALESCE(SUM(kg),0) AS t FROM multifruit_stock_fruits WHERE entreprise_id = ?', ent.id).t,
      venduAujourdhui: (un('SELECT litres FROM multifruit_ventes_jour WHERE entreprise_id = ? AND jour = ?', ent.id, jourCourant()) || { litres: 0 }).litres,
    };
  });
}

// Exécute une action de jeu : entreprise + rattrapage + transaction, puis renvoie le message de résultat.
function action(userId, fn) {
  const base = entrepriseOuErreur(userId);
  return transaction(() => {
    regler(base);
    return fn(un('SELECT * FROM multifruit_entreprises WHERE id = ?', base.id));
  });
}

const niveauMachine = (ent, machineId) => {
  const m = un('SELECT niveau FROM multifruit_machines WHERE entreprise_id = ? AND machine_id = ?', ent.id, machineId);
  return m ? C.machines[machineId].niveaux[m.niveau - 1] : null;
};
const machineOccupee = (ent, machineId) =>
  !!un("SELECT 1 FROM multifruit_lots WHERE entreprise_id = ? AND machine_id = ? AND statut = 'en_cours'", ent.id, machineId);

// ── Achats ───────────────────────────────────────────────────────────────────
function acheterFruits(userId, fruitId, caisses) {
  const f = C.fruits[fruitId]; if (!f || !f.debloque_par_defaut) ko('Fruit indisponible.');
  if (!Number.isInteger(caisses) || caisses < 1) ko('Nombre de caisses invalide.');
  return action(userId, ent => {
    const kg = caisses * C.eq.caisse_kg;
    const total = un('SELECT COALESCE(SUM(kg),0) AS t FROM multifruit_stock_fruits WHERE entreprise_id = ?', ent.id).t;
    if (total + kg > ent.capacite_fruits_kg + EPS) ko(`Stock de fruits plein : il reste **${r2(ent.capacite_fruits_kg - total)} kg** de place.`);
    debiter(ent, kg * f.prix_kg, 'achat_fruits', `${kg} kg ${f.id}`);
    ajouter('multifruit_stock_fruits', { entreprise_id: ent.id, fruit_id: f.id }, 'kg', kg);
    return `${f.emoji} **${kg} kg** de ${f.nom.toLowerCase()} achetés pour **${r2(kg * f.prix_kg)}** 🪙.`;
  });
}

function ameliorerStockFruits(userId) {
  return action(userId, ent => {
    debiter(ent, C.eq.stock_fruits_amelioration_prix, 'amelioration_stock', 'stock fruits');
    run('UPDATE multifruit_entreprises SET capacite_fruits_kg = capacite_fruits_kg + ? WHERE id = ?', C.eq.stock_fruits_amelioration_kg, ent.id);
    return `📦 Stock de fruits agrandi de **${C.eq.stock_fruits_amelioration_kg} kg**.`;
  });
}

function acheterMachine(userId, machineId) {
  const m = C.machines[machineId]; if (!m) ko('Machine inconnue.');
  if (!m.debloque_par_defaut) ko('Cette machine n\'est pas encore débloquée.');
  return action(userId, ent => {
    if (un('SELECT 1 FROM multifruit_machines WHERE entreprise_id = ? AND machine_id = ?', ent.id, m.id)) ko('Tu possèdes déjà cette machine.');
    debiter(ent, m.prix, 'achat_machine', m.id);
    run('INSERT INTO multifruit_machines (entreprise_id, machine_id, niveau) VALUES (?,?,1)', ent.id, m.id);
    return `${m.emoji} **${m.nom}** achetée pour **${m.prix}** 🪙.`;
  });
}

function ameliorerMachine(userId, machineId) {
  const m = C.machines[machineId]; if (!m) ko('Machine inconnue.');
  return action(userId, ent => {
    const poss = un('SELECT niveau FROM multifruit_machines WHERE entreprise_id = ? AND machine_id = ?', ent.id, m.id);
    if (!poss) ko('Tu ne possèdes pas cette machine.');
    const suivant = m.niveaux[poss.niveau];
    if (!suivant) ko('Cette machine est déjà au niveau maximum.');
    if (machineOccupee(ent, m.id)) ko('La machine est en cours de travail : attends la fin du lot.');
    debiter(ent, suivant.prix_amelioration, 'amelioration_machine', `${m.id} → niv ${suivant.niveau}`);
    run('UPDATE multifruit_machines SET niveau = ? WHERE entreprise_id = ? AND machine_id = ?', suivant.niveau, ent.id, m.id);
    return `${m.emoji} **${m.nom}** passe au niveau **${suivant.niveau}** (${suivant.prix_amelioration} 🪙).`;
  });
}

function acheterCuve(userId, typeId) {
  const t = C.cuves[typeId]; if (!t) ko('Cuve inconnue.');
  return action(userId, ent => {
    debiter(ent, t.prix, 'achat_cuve', t.id);
    run('INSERT INTO multifruit_cuves (entreprise_id, type_cuve, capacite_l) VALUES (?,?,?)', ent.id, t.id, t.capacite_l);
    return `${t.emoji} **${t.nom}** achetée pour **${t.prix}** 🪙.`;
  });
}

function ameliorerCuve(userId, cuveId) {
  return action(userId, ent => {
    const c = un('SELECT * FROM multifruit_cuves WHERE id = ? AND entreprise_id = ?', cuveId, ent.id); if (!c) ko('Cuve introuvable.');
    const t = C.cuves[c.type_cuve];
    debiter(ent, t.amelioration_prix, 'amelioration_cuve', `cuve ${c.id}`);
    run('UPDATE multifruit_cuves SET capacite_l = capacite_l + ? WHERE id = ?', t.amelioration_ajout_l, c.id);
    return `${t.emoji} Cuve n°${c.id} agrandie de **${t.amelioration_ajout_l} L** (${t.amelioration_prix} 🪙).`;
  });
}

function commanderContenants(userId, contenantId, qte) {
  const c = C.contenants[contenantId]; if (!c || !c.debloque_par_defaut) ko('Contenant indisponible.');
  if (!Number.isInteger(qte) || qte < 1) ko('Quantité invalide.');
  return action(userId, ent => {
    debiter(ent, qte * c.prix_unitaire, 'achat_contenants', `${qte} ${c.id}`);
    ajouter('multifruit_stock_contenants', { entreprise_id: ent.id, contenant_id: c.id }, 'quantite', qte);
    return `${c.emoji} **${qte}** × ${c.nom} commandés pour **${r2(qte * c.prix_unitaire)}** 🪙.`;
  });
}

// ── Production ───────────────────────────────────────────────────────────────
function lancerPressage(userId, fruitId, kg) {
  const f = C.fruits[fruitId]; if (!f) ko('Fruit inconnu.');
  if (!(kg > 0)) ko('Quantité invalide.');
  return action(userId, ent => {
    const possedees = f.machines_compatibles.map(id => ({ id, niv: niveauMachine(ent, id) })).filter(x => x.niv);
    if (!possedees.length) ko(`Il te faut une machine compatible : ${f.machines_compatibles.map(id => C.machines[id].nom).join(', ')} (bouton **Usine**).`);
    const libre = possedees.find(x => !machineOccupee(ent, x.id));
    if (!libre) ko('Ton pressoir est occupé : attends la fin du lot en cours.');
    const mach = C.machines[libre.id];
    if (kg > libre.niv.capacite + EPS) ko(`Ton ${mach.nom.toLowerCase()} traite **${libre.niv.capacite} kg** maximum par lot.`);
    const stock = un('SELECT kg FROM multifruit_stock_fruits WHERE entreprise_id = ? AND fruit_id = ?', ent.id, f.id);
    if (!stock || stock.kg + EPS < kg) ko(`Pas assez de ${f.nom.toLowerCase()} en stock (${stock ? stock.kg : 0} kg).`);
    const litres = r2(kg * f.rendement_l_par_kg * (1 + (libre.niv.bonus_rendement || 0)));
    const cuve = tous('SELECT * FROM multifruit_cuves WHERE entreprise_id = ? ORDER BY (jus_id = ?) DESC, id', ent.id, f.jus)
      .find(c => (c.jus_id === null || c.jus_id === f.jus) && c.capacite_l - c.volume_l - c.reserve_l + EPS >= litres);
    if (!cuve) ko(`Aucune cuve compatible avec assez de place (**${litres} L** à stocker). Achète ou agrandis une cuve.`);

    run('UPDATE multifruit_stock_fruits SET kg = ? WHERE entreprise_id = ? AND fruit_id = ?', r2(stock.kg - kg), ent.id, f.id);
    run('UPDATE multifruit_cuves SET jus_id = ?, reserve_l = ? WHERE id = ?', f.jus, r2(cuve.reserve_l + litres), cuve.id);
    const debut = Date.now(), fin = debut + libre.niv.duree_s * 1000;
    run('INSERT INTO multifruit_lots (entreprise_id, type, machine_id, entrees, sorties, debut, fin) VALUES (?,?,?,?,?,?,?)',
      ent.id, 'pressage', libre.id, JSON.stringify({ fruit_id: f.id, kg }), JSON.stringify({ jus_id: f.jus, litres, cuve_id: cuve.id }), debut, fin);
    journal(ent, 'pressage', `${kg} kg ${f.id} → ${litres} L`);
    stat(ent, 'fruits_presses_kg', kg); stat(ent, 'jus_presse_l', litres);
    return `${f.emoji} Pressage lancé : **${kg} kg** → **${litres} L** de ${C.jus[f.jus].nom.toLowerCase()}, fini <t:${Math.floor(fin / 1000)}:R>.`;
  });
}

function mettreEnBouteille(userId, cuveId, contenantId, qte) {
  const ct = C.contenants[contenantId]; if (!ct || !ct.debloque_par_defaut) ko('Contenant indisponible.');
  if (!Number.isInteger(qte) || qte < 1) ko('Quantité invalide.');
  return action(userId, ent => {
    const cuve = un('SELECT * FROM multifruit_cuves WHERE id = ? AND entreprise_id = ?', cuveId, ent.id); if (!cuve) ko('Cuve introuvable.');
    if (!cuve.jus_id || cuve.volume_l <= 0) ko('Cette cuve ne contient pas de jus prêt à embouteiller.');
    const machineId = ct.machine_requise;
    const niv = niveauMachine(ent, machineId);
    if (!niv) ko(`Il te faut : ${C.machines[machineId].nom} (bouton **Usine**).`);
    if (machineOccupee(ent, machineId)) ko('La machine de remplissage est occupée : attends la fin du lot.');
    if (qte > niv.capacite) ko(`Cette machine remplit **${niv.capacite}** contenants maximum par lot.`);
    const volume = r2(qte * ct.volume_l);
    if (volume > cuve.volume_l + EPS) ko(`La cuve ne contient que **${cuve.volume_l} L** (il en faut ${volume}).`);
    const stock = un('SELECT quantite FROM multifruit_stock_contenants WHERE entreprise_id = ? AND contenant_id = ?', ent.id, ct.id);
    if (!stock || stock.quantite < qte) ko(`Pas assez de contenants vides (${stock ? stock.quantite : 0} en stock).`);

    const reste = r2(cuve.volume_l - volume);
    run('UPDATE multifruit_stock_contenants SET quantite = quantite - ? WHERE entreprise_id = ? AND contenant_id = ?', qte, ent.id, ct.id);
    run('UPDATE multifruit_cuves SET volume_l = ?, jus_id = ? WHERE id = ?', reste, reste <= 0 && cuve.reserve_l <= 0 ? null : cuve.jus_id, cuve.id);
    const debut = Date.now(), fin = debut + niv.duree_s * 1000;
    run('INSERT INTO multifruit_lots (entreprise_id, type, machine_id, entrees, sorties, debut, fin) VALUES (?,?,?,?,?,?,?)',
      ent.id, 'embouteillage', machineId, JSON.stringify({ cuve_id: cuve.id, volume }), JSON.stringify({ jus_id: cuve.jus_id, contenant_id: ct.id, quantite: qte }), debut, fin);
    journal(ent, 'embouteillage', `${qte} ${ct.id} (${cuve.jus_id})`);
    stat(ent, 'bouteilles_generees', qte);
    return `${ct.emoji} Mise en bouteille lancée : **${qte}** × ${ct.nom}, prête <t:${Math.floor(fin / 1000)}:R>.`;
  });
}

// ── Vente au comptoir ────────────────────────────────────────────────────────
function vendre(userId, jusId, contenantId, qte) {
  const ct = C.contenants[contenantId], j = C.jus[jusId]; if (!ct || !j) ko('Produit inconnu.');
  if (!Number.isInteger(qte) || qte < 1) ko('Quantité invalide.');
  return action(userId, ent => {
    const p = un('SELECT quantite FROM multifruit_produits_finis WHERE entreprise_id = ? AND jus_id = ? AND contenant_id = ?', ent.id, j.id, ct.id);
    if (!p || p.quantite < qte) ko(`Tu n'as que ${p ? p.quantite : 0} de ce produit.`);
    const litres = r2(qte * ct.volume_l), jour = jourCourant();
    const deja = (un('SELECT litres FROM multifruit_ventes_jour WHERE entreprise_id = ? AND jour = ?', ent.id, jour) || { litres: 0 }).litres;
    const reste = r2(C.eq.comptoir_limite_l_par_jour - deja);
    if (litres > reste + EPS) ko(`Limite du comptoir : il reste **${Math.max(0, reste)} L** à vendre aujourd'hui.`);
    const gain = r2(litres * j.prix_vente_l * ct.multiplicateur_vente * C.eq.comptoir_coef);
    run('UPDATE multifruit_produits_finis SET quantite = quantite - ? WHERE entreprise_id = ? AND jus_id = ? AND contenant_id = ?', qte, ent.id, j.id, ct.id);
    ajouter('multifruit_ventes_jour', { entreprise_id: ent.id, jour }, 'litres', litres);
    crediter(ent, gain, 'vente_comptoir', `${qte} ${ct.id} ${j.id}`);
    stat(ent, 'bouteilles_vendues', qte);
    return `💰 **${qte}** × ${j.nom} (${ct.nom}) vendus au comptoir pour **${gain}** 🪙.`;
  });
}

// Top n d'un classement : 'pieces' (solde actuel) ou une clé de multifruit_stats.
function classement(cle, n = 10) {
  return cle === 'pieces'
    ? tous('SELECT nom, pieces AS valeur FROM multifruit_entreprises ORDER BY pieces DESC, id LIMIT ?', n)
    : tous('SELECT e.nom, s.valeur FROM multifruit_stats s JOIN multifruit_entreprises e ON e.id = s.entreprise_id WHERE s.cle = ? AND s.valeur > 0 ORDER BY s.valeur DESC, e.id LIMIT ?', cle, n);
}

// ── Maximums réalisables (affichage ; les vraies vérifications restent dans les actions) ──
const fl = (n, d = 2) => Math.floor(n * 10 ** d + 1e-9) / 10 ** d;
const machineEtat = (e, id) => {
  const m = e.machines.find(x => x.machine_id === id);
  return m ? { niv: C.machines[id].niveaux[m.niveau - 1], niveau: m.niveau, occupee: e.lots.some(l => l.machine_id === id) } : null;
};
function maxPressage(e, fruitId) {
  const f = C.fruits[fruitId];
  const poss = f.machines_compatibles.map(id => ({ id, ...machineEtat(e, id) })).filter(x => x.niv);
  if (!poss.length) return { max: 0, raison: 'Aucune machine compatible : achète-en une dans Usine.' };
  const m = poss.find(x => !x.occupee);
  if (!m) return { max: 0, raison: 'Ton pressoir est occupé : attends la fin du lot en cours.' };
  const stock = (e.fruits.find(x => x.fruit_id === fruitId) || { kg: 0 }).kg;
  const rend = f.rendement_l_par_kg * (1 + (m.niv.bonus_rendement || 0));
  const libreL = Math.max(0, ...e.cuves.filter(c => c.jus_id === null || c.jus_id === f.jus).map(c => c.capacite_l - c.volume_l - c.reserve_l));
  const max = fl(Math.min(m.niv.capacite, stock, libreL / rend), 1);
  return { max, niv: m.niv, stock, rend, libreL: r2(libreL),
    raison: max > 0 ? '' : stock <= 0 ? 'Plus de fruits en stock.' : 'Aucune cuve compatible avec de la place libre.' };
}
function maxBouteille(e, cuveId, contenantId) {
  const c = e.cuves.find(x => x.id === Number(cuveId)), ct = C.contenants[contenantId];
  const m = machineEtat(e, ct.machine_requise);
  if (!c || !m) return { max: 0, raison: 'Il te faut : ' + C.machines[ct.machine_requise].nom + ' (Usine).' };
  if (m.occupee) return { max: 0, raison: 'La machine de remplissage est occupée.' };
  const vides = (e.contenants.find(x => x.contenant_id === contenantId) || { quantite: 0 }).quantite;
  const max = Math.floor(Math.min(m.niv.capacite, c.volume_l / ct.volume_l + 1e-9, vides));
  return { max, niv: m.niv, vides, raison: max > 0 ? '' : vides <= 0 ? 'Aucun contenant vide : commande des ' + ct.nom + '.' : 'Cuve vide.' };
}
const maxAchatFruits = (e, id) => Math.max(0, Math.floor(Math.min(e.ent.capacite_fruits_kg - e.kgFruits, e.ent.pieces / C.fruits[id].prix_kg) / C.eq.caisse_kg + 1e-9));
const maxContenants = (e, id) => Math.max(0, Math.floor(e.ent.pieces / C.contenants[id].prix_unitaire + 1e-9));
function maxVente(e, jusId, contenantId) {
  const p = e.produits.find(x => x.jus_id === jusId && x.contenant_id === contenantId);
  const reste = Math.max(0, C.eq.comptoir_limite_l_par_jour - e.venduAujourdhui);
  return Math.max(0, Math.min(p ? p.quantite : 0, Math.floor(reste / C.contenants[contenantId].volume_l + 1e-9)));
}

// ── Bons de commande (marché) ────────────────────────────────────────────────
// Le marché affiche NB_BONS bons générés par des entreprises fictives (data/clients.json). Un bon non pris est remplacé
// après BON_ATTENTE_MS ; une fois pris, il devient une commande à livrer sous COMMANDE_DELAI_MS.
// Les bons ne portent que sur des jus/contenants jouables par défaut (le tableau est commun à tous les joueurs).
const NB_BONS = 5, MAX_COMMANDES = 3, BON_ATTENTE_MS = 12 * 3600e3, COMMANDE_DELAI_MS = 24 * 3600e3;
const choix = liste => liste[Math.floor(Math.random() * liste.length)];

function genererBon() {
  const jus = Object.values(C.jus).filter(j => Object.values(C.fruits).some(f => f.jus === j.id && f.debloque_par_defaut));
  const contenants = Object.values(C.contenants).filter(c => c.debloque_par_defaut);
  if (!jus.length || !contenants.length) return;
  const j = choix(jus), c = choix(contenants), q = choix([10, 20, 30, 40, 50]);
  const prix = r2(q * c.volume_l * j.prix_vente_l * c.multiplicateur_vente * (1.15 + Math.random() * 0.35));  // 115 à 150 % du prix de base
  run('INSERT INTO multifruit_bons (client_id, jus_id, contenant_id, quantite, prix_total, cree) VALUES (?,?,?,?,?,?)',
    choix(Object.keys(C.clients)), j.id, c.id, q, prix, Date.now());
}

// Pas de transaction propre : appelée aussi depuis action(), et node:sqlite est synchrone.
function bons() {
  run('DELETE FROM multifruit_bons WHERE cree < ?', Date.now() - BON_ATTENTE_MS);
  for (let n = un('SELECT COUNT(*) AS n FROM multifruit_bons').n; n < NB_BONS; n++) genererBon();
  return tous('SELECT * FROM multifruit_bons ORDER BY id').filter(b => C.clients[b.client_id] && C.jus[b.jus_id] && C.contenants[b.contenant_id]);
}

function accepterBon(userId, bonId) {
  return action(userId, ent => {
    const b = bons().find(x => x.id === bonId); if (!b) ko('Ce bon a déjà été pris par une autre entreprise.');
    const actives = un("SELECT COUNT(*) AS n FROM multifruit_commandes WHERE entreprise_id = ? AND statut = 'en_cours'", ent.id).n;
    if (actives >= MAX_COMMANDES) ko(`Tu as déjà **${MAX_COMMANDES}** commandes en cours : livre-en une d'abord.`);
    run('DELETE FROM multifruit_bons WHERE id = ?', b.id);
    run('INSERT INTO multifruit_commandes (entreprise_id, client_id, jus_id, contenant_id, quantite, prix_total, echeance) VALUES (?,?,?,?,?,?,?)',
      ent.id, b.client_id, b.jus_id, b.contenant_id, b.quantite, b.prix_total, Date.now() + COMMANDE_DELAI_MS);
    journal(ent, 'commande_acceptee', `${b.quantite} ${b.contenant_id} ${b.jus_id} pour ${b.client_id}`);
    return `📋 Commande de **${C.clients[b.client_id].nom}** acceptée : **${b.quantite}** × ${C.jus[b.jus_id].nom} (${C.contenants[b.contenant_id].nom}) pour **${b.prix_total}** 🪙, à livrer sous 24 h.`;
  });
}

// Livraison : tout ou rien, depuis le stock de produits finis.
function livrerCommande(userId, commandeId) {
  return action(userId, ent => {
    const o = un("SELECT * FROM multifruit_commandes WHERE id = ? AND entreprise_id = ? AND statut = 'en_cours'", commandeId, ent.id);
    if (!o) ko('Commande introuvable ou expirée.');
    const p = un('SELECT quantite FROM multifruit_produits_finis WHERE entreprise_id = ? AND jus_id = ? AND contenant_id = ?', ent.id, o.jus_id, o.contenant_id);
    if (!p || p.quantite < o.quantite) ko(`Commande incomplète : ${p ? p.quantite : 0} / ${o.quantite} en stock.`);
    run('UPDATE multifruit_produits_finis SET quantite = quantite - ? WHERE entreprise_id = ? AND jus_id = ? AND contenant_id = ?', o.quantite, ent.id, o.jus_id, o.contenant_id);
    run("UPDATE multifruit_commandes SET statut = 'livree' WHERE id = ?", o.id);
    crediter(ent, o.prix_total, 'commande_livree', `${o.quantite} ${o.contenant_id} ${o.jus_id} ${o.client_id}`);
    stat(ent, 'bouteilles_vendues', o.quantite);
    return `📦 Commande livrée à **${C.clients[o.client_id].nom}** : **+${o.prix_total}** 🪙.`;
  });
}

// ── Config (salons créés par /multifruit-installer) ─────────────────────────
const lireConfig = cle => (un('SELECT valeur FROM multifruit_config WHERE cle = ?', cle) || {}).valeur || null;
const ecrireConfig = (cle, v) =>
  run('INSERT INTO multifruit_config (cle, valeur) VALUES (?,?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur', cle, String(v));

module.exports = {
  JeuErreur, entreprise, creerEntreprise, etat,
  acheterFruits, ameliorerStockFruits, acheterMachine, ameliorerMachine, acheterCuve, ameliorerCuve,
  commanderContenants, lancerPressage, mettreEnBouteille, vendre, lireConfig, ecrireConfig,
  bons, accepterBon, livrerCommande,
  classement, maxPressage, maxBouteille, maxAchatFruits, maxContenants, maxVente, machineEtat,
};
