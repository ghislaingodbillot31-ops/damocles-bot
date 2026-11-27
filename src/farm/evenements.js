// DÉFI HEBDOMADAIRE : chaque lundi (heure de Paris), 3 défis de vente (facile / moyen / difficile) sur des produits tirés au sort.
// Le mod compte les litres vendus aux points de vente (compteur « sold », par ferme et par produit) : le défi se mesure
// sur ce qui a été vendu depuis le lundi, peu importe l'origine (récolte ou achat à un autre joueur).
// Récompense : points (500 / 1000 / 3000) ; le classement du HUB compte le nombre de défis relevés (cumulé), les points départagent.
const fs = require('fs');
const crypto = require('crypto');
const { dataPath } = require('../core/paths');

const FILE = dataPath('evenements.json');
const NIVEAUX = [
  { niveau: 'facile', emoji: '🟢', label: 'Facile', mult: 1, pts: 500 },
  { niveau: 'moyen', emoji: '🟠', label: 'Moyen', mult: 4, pts: 1000 },
  { niveau: 'difficile', emoji: '🔴', label: 'Difficile', mult: 12, pts: 3000 },
];
// ft = nom FS25 du produit ; base = quantité (L) du défi facile (moyen ×4, difficile ×12)
// fam = famille : un produit dérivé partage la famille de sa matière première (farine ← céréales, sucre ← betteraves) ;
// les 3 défis de la semaine viennent toujours de 3 familles différentes.
const PRODUITS = [
  { ft: 'WHEAT', nom: 'Blé', emoji: '🌾', base: 5000, fam: 'cereales' }, { ft: 'BARLEY', nom: 'Orge', emoji: '🌾', base: 5000, fam: 'cereales' },
  { ft: 'OAT', nom: 'Avoine', emoji: '🌾', base: 4000, fam: 'cereales' }, { ft: 'CANOLA', nom: 'Colza', emoji: '🌼', base: 4000 },
  { ft: 'SUNFLOWER', nom: 'Tournesol', emoji: '🌻', base: 4000 }, { ft: 'SOYBEAN', nom: 'Soja', emoji: '🫘', base: 4000 },
  { ft: 'MAIZE', nom: 'Maïs', emoji: '🌽', base: 8000 }, { ft: 'POTATO', nom: 'Pommes de terre', emoji: '🥔', base: 5000 },
  { ft: 'SUGARBEET', nom: 'Betteraves', emoji: '🥬', base: 8000, fam: 'betterave' }, { ft: 'MILK', nom: 'Lait', emoji: '🥛', base: 5000 },
  { ft: 'EGG', nom: 'Œufs', emoji: '🥚', base: 500 }, { ft: 'WOOL', nom: 'Laine', emoji: '🐑', base: 1000 },
  { ft: 'HONEY', nom: 'Miel', emoji: '🍯', base: 500 }, { ft: 'FLOUR', nom: 'Farine', emoji: '🥖', base: 2000, fam: 'cereales' },
  { ft: 'SUGAR', nom: 'Sucre', emoji: '🍬', base: 2000, fam: 'betterave' }, { ft: 'WOODCHIPS', nom: 'Plaquettes de bois', emoji: '🪵', base: 5000 },
];

let etat = { semaine: null, defis: [], base: {}, fait: {}, points: {}, msgId: null };
try { etat = { ...etat, ...JSON.parse(fs.readFileSync(FILE, 'utf-8')) }; } catch {}
const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(etat), 'utf-8'); } catch {} };

const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ');

// Lundi (YYYY-MM-DD, heure de Paris) de la semaine de `d`
function lundi(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - dow)).toISOString().slice(0, 10);
}
const jourFr = (iso, plus = 0) => new Date(Date.parse(iso) + plus * 86400000).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' });

function tirerDefis() {
  const liste = [...PRODUITS];
  for (let i = liste.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [liste[i], liste[j]] = [liste[j], liste[i]]; }
  const choix = [];
  for (const p of liste) if (choix.length < NIVEAUX.length && !choix.some((c) => (c.fam || c.ft) === (p.fam || p.ft))) choix.push(p);
  return NIVEAUX.map((n, i) => ({ niveau: n.niveau, ft: choix[i].ft, qte: choix[i].base * n.mult, pts: n.pts }));
}

const vendu = (status, farmId, ft) => status.counters.filter((c) => c.kind === 'sold' && c.farm === farmId && c.fillType === ft).reduce((s, c) => s + c.value, 0);

// Point de départ d'une ferme pour les produits de la semaine (fixé la première fois qu'on la voit)
function initBase(status, farm) {
  if (etat.base[farm.id]) return;
  etat.base[farm.id] = Object.fromEntries(etat.defis.map((d) => [d.ft, vendu(status, farm.id, d.ft)]));
}
const progres = (status, farm, d) => { initBase(status, farm); return Math.max(0, vendu(status, farm.id, d.ft) - (etat.base[farm.id][d.ft] || 0)); };

const produit = (ft) => PRODUITS.find((p) => p.ft === ft) || { nom: ft, emoji: '📦' };
const meta = (niveau) => NIVEAUX.find((n) => n.niveau === niveau);

// Nouvelle semaine : nouveaux défis, compteurs de départ relevés. Renvoie true si changement.
function rotation(status) {
  const sem = lundi();
  const fam = (d) => { const p = PRODUITS.find((q) => q.ft === d.ft); return p?.fam || d.ft; };
  const incoherent = new Set(etat.defis.map(fam)).size < etat.defis.length; // défis déjà tirés avec un produit dérivé d'un autre : on retire
  if (etat.semaine === sem && !incoherent) return false;
  etat = { ...etat, semaine: sem, defis: tirerDefis(), base: {}, fait: {} };
  for (const f of status.farms) initBase(status, f);
  return true;
}

// Défis terminés pendant ce relevé -> points + lignes d'annonce
function attribuer(status, fermes) {
  const annonces = [];
  for (const farm of fermes) {
    for (const d of etat.defis) {
      const fait = (etat.fait[farm.id] ||= []);
      if (fait.includes(d.niveau) || progres(status, farm, d) < d.qte) continue;
      fait.push(d.niveau);
      const p = (etat.points[farm.id] ||= { nom: farm.name, total: 0, nb: 0 });
      p.nom = farm.name; p.total += meta(d.niveau).pts; p.nb = (p.nb || 0) + 1;
      const m = meta(d.niveau), pr = produit(d.ft);
      annonces.push(`🎯 **${farm.name}** a réussi le défi ${m.emoji} ${m.label} : vendre ${fmt(d.qte)} L de ${pr.emoji} ${pr.nom}  ·  **+${meta(d.niveau).pts} pts**`);
    }
  }
  return annonces;
}

// Bloc « défis de la semaine » affiché dans le HUB des succès : une ligne par défi.
function resume(status) {
  if (!status || !etat.defis.length) return '';
  const fermes = status.farms.filter((f) => f.name && !require('./niveaux').estForet(f));
  const lignes = etat.defis.map((d) => {
    const m = meta(d.niveau), pr = produit(d.ft);
    const faits = fermes.filter((f) => (etat.fait[f.id] || []).includes(d.niveau)).map((f) => f.name);
    return `${m.emoji} Vendre **${fmt(d.qte)} L** de ${pr.emoji} ${pr.nom} · **+${meta(d.niveau).pts} pts**${faits.length ? `\n✅ ${faits.join(', ')}` : ''}`;
  });
  return [`Du **${jourFr(etat.semaine)}** au **${jourFr(etat.semaine, 6)}** · nouveaux défis chaque lundi`, ...lignes].join('\n');
}

let derniereCle = null;

// Appelé à chaque relevé (et après le vidage du salon, avec force=true) : rotation, points, annonces, HUB.
async function maj(status, channel, force = false) {
  if (!status || !channel) return;
  const fermes = status.farms.filter((f) => f.name && !require('./niveaux').estForet(f));
  const change = rotation(status);
  const annonces = attribuer(status, fermes);
  if (change || annonces.length) save();
  if (annonces.length) {
    for (const a of annonces) await require('../core/agrilog').agrilog(channel.guild, a); // uniquement dans le salon de logs (jamais dans le salon du HUB)
  }

  if (etat.msgId) { // ancien message du défi, désormais intégré au HUB des succès
    await channel.messages.fetch(etat.msgId).then((m) => m?.delete()).catch(() => {});
    etat.msgId = null; save();
  }
  const cle = resume(status);
  if (!force && cle === derniereCle) return;
  derniereCle = cle;
  await require('./fs25-succes-hub').update(status, channel).catch((e) => console.warn(`[FS25] Hub succès : ${e.message}`));
}

module.exports = { maj, resume, lundi, tirerDefis, PRODUITS, _etat: () => etat, _reset: (e) => { etat = e; derniereCle = null; } };
