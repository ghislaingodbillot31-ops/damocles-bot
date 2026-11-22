// DÉFI HEBDOMADAIRE : chaque lundi (heure de Paris), 3 défis de vente (facile / moyen / difficile) sur des produits tirés au sort.
// Le mod compte les litres vendus aux points de vente (compteur « sold », par ferme et par produit) : le défi se mesure
// sur ce qui a été vendu depuis le lundi, peu importe l'origine (récolte ou achat à un autre joueur).
// Récompense : points (50 / 150 / 500) ; le classement du HUB compte le nombre de défis relevés (cumulé), les points départagent.
const fs = require('fs');
const crypto = require('crypto');
const { dataPath } = require('../core/paths');
const { panneauEmbed } = require('../core/embed-format');

const FILE = dataPath('evenements.json');
const FOOTER = 'MonCopainBot · Défi hebdomadaire';
const NIVEAUX = [
  { niveau: 'facile', emoji: '🟢', label: 'Facile', mult: 1, pts: 50 },
  { niveau: 'moyen', emoji: '🟠', label: 'Moyen', mult: 4, pts: 150 },
  { niveau: 'difficile', emoji: '🔴', label: 'Difficile', mult: 12, pts: 500 },
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
      p.nom = farm.name; p.total += d.pts; p.nb = (p.nb || 0) + 1;
      const m = meta(d.niveau), pr = produit(d.ft);
      annonces.push(`🎯 **${farm.name}** a réussi le défi ${m.emoji} ${m.label} : vendre ${fmt(d.qte)} L de ${pr.emoji} ${pr.nom}  ·  **+${d.pts} pts**`);
    }
  }
  return annonces;
}

function buildMessage(status, fermes) {
  const medals = ['🥇', '🥈', '🥉'];
  const blocs = etat.defis.map((d) => {
    const m = meta(d.niveau), pr = produit(d.ft);
    const faits = fermes.filter((f) => (etat.fait[f.id] || []).includes(d.niveau)).map((f) => f.name);
    const enCours = fermes.filter((f) => !faits.includes(f.name)).map((f) => ({ f, v: progres(status, f, d) })).filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${x.f.name} ${fmt(x.v)}/${fmt(d.qte)}`);
    return [`${m.emoji} **${m.label}**  ·  Vendre **${fmt(d.qte)} L** de ${pr.emoji} **${pr.nom}**  ·  **+${d.pts} pts**`,
      faits.length ? `✅ ${faits.join(', ')}` : null, enCours.length ? `⏳ ${enCours.join(' · ')}` : null].filter(Boolean).join('\n');
  });
  const classement = fermes.map((f) => ({ f, nb: etat.points[f.id]?.nb || 0, pts: etat.points[f.id]?.total || 0, sem: (etat.fait[f.id] || []).length }))
    .sort((a, b) => b.nb - a.nb || b.pts - a.pts || a.f.name.localeCompare(b.f.name, 'fr'))
    .map((r, i) => `${medals[i] || '`' + String(i + 1).padStart(2) + '`'} **${r.f.name}** · ${r.nb} défi${r.nb > 1 ? 's' : ''} relevé${r.nb > 1 ? 's' : ''}${r.sem ? ` (+${r.sem} cette semaine)` : ''}`);
  return { embeds: [panneauEmbed({
    title: '🎯 DÉFI HEBDOMADAIRE',
    color: 0xE67E22,
    description: [`Du **${jourFr(etat.semaine)}** au **${jourFr(etat.semaine, 6)}** (nouveaux défis chaque lundi)`,
      'Vends au **point de vente** la quantité demandée. Il te manque du stock ? Achète-le à un autre joueur 🤝', '',
      ...blocs.flatMap((b) => [b, '']), '**🏆 Classement des exploitations**', classement.join('\n') || '_Aucune exploitation._'].join('\n').slice(0, 4000),
    footer: { text: FOOTER },
  })] };
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

  const msg = buildMessage(status, fermes);
  const cle = JSON.stringify(msg);
  if (!force && cle === derniereCle) return;
  const m = !force && etat.msgId ? await channel.messages.fetch(etat.msgId).catch(() => null) : null;
  if (m) await m.edit(msg);
  else { etat.msgId = (await channel.send(msg)).id; save(); }
  derniereCle = cle;
}

module.exports = { maj, lundi, tirerDefis, PRODUITS, _etat: () => etat, _reset: (e) => { etat = e; derniereCle = null; } };
