// Construction des embeds et composants Discord (aucune logique de jeu ici).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { panneau, SEP } = require('../../embed-format');
const C = require('../systems/contenu');
const jeu = require('../systems/jeu');

const COULEUR = 0xF39C12;
const nb = n => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const barre = (p, n = 10) => { const k = Math.round(Math.max(0, Math.min(1, p)) * n); return '▰'.repeat(k) + '▱'.repeat(n - k); };

const bouton = (id, label, style = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
const menu = (id, placeholder, options) =>
  new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options.slice(0, 25)));
const duree = s => s >= 60 ? Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '') : s + ' s';
// Mise en page : un item = titre + lignes « ↳ » ; les items sont séparés par une ligne vide. Un champ Discord ne dépasse pas 1024 caractères.
const item = (titre, ...details) => [titre, ...details.filter(Boolean).map(d => '↳ ' + d)].join('\n');
// Un trait (SEP, 60 « ─ ») en dernière ligne de chaque rubrique les sépare visuellement.
const bloc = (items, vide = '—') => (items.length ? items.join('\n\n') : vide).slice(0, 1000) + '\n' + SEP;
const retour = () => new ActionRowBuilder().addComponents(bouton('mf:hub', '◀ Retour au HUB'));

const habiller = (embed, components, notice) => panneau({
  content: notice || '',
  embeds: [{ color: COULEUR, footer: { text: 'MonCopainBot · Multifruit' }, ...embed }],
  components,
});

// ── HUB ──────────────────────────────────────────────────────────────────────
function vueHub(e, notice) {
  const { ent } = e;
  const lots = e.lots.map(l => {
    const s = JSON.parse(l.sorties), p = (Date.now() - l.debut) / (l.fin - l.debut);
    const quoi = l.type === 'pressage' ? `**Pressage** — ${nb(JSON.parse(l.entrees).kg)} kg → ${nb(s.litres)} L de ${C.jus[s.jus_id].nom.toLowerCase()}` : `**Mise en bouteille** — ${s.quantite} × ${C.contenants[s.contenant_id].nom}`;
    return item(`${C.machines[l.machine_id].emoji} ${quoi}`, `${barre(p)} fini <t:${Math.floor(l.fin / 1000)}:R>`);
  });
  const machines = e.machines.map(m => {
    const def = C.machines[m.machine_id], niv = def.niveaux[m.niveau - 1], occ = e.lots.some(l => l.machine_id === m.machine_id);
    return item(`${def.emoji} **${def.nom}** · niveau ${m.niveau}${occ ? ' · ⏳ au travail' : ' · ✅ libre'}`, `${niv.capacite} par lot · ${duree(niv.duree_s)}`);
  });
  const cuves = e.cuves.map(c => {
    const j = c.jus_id ? C.jus[c.jus_id] : null;
    return item(`🛢️ **Cuve n°${c.id}** — ${j ? j.emoji + ' ' + j.nom : 'vide'}`,
      `${barre(c.volume_l / c.capacite_l)} ${nb(c.volume_l)} / ${nb(c.capacite_l)} L${c.reserve_l ? ` · +${nb(c.reserve_l)} L en cours de pressage` : ''}`);
  });
  const fruits = e.fruits.map(f => `${C.fruits[f.fruit_id].emoji} **${C.fruits[f.fruit_id].nom}** · ${nb(f.kg)} kg`);
  const vides = e.contenants.map(c => `${C.contenants[c.contenant_id].emoji} **${C.contenants[c.contenant_id].nom}** · ${c.quantite}`);
  const commandes = e.commandes.map(o => {
    const st = stockDe(e, o), ok = st >= o.quantite;
    return item(`${C.clients[o.client_id].emoji} **${C.clients[o.client_id].nom}** — ${o.quantite} × ${C.jus[o.jus_id].nom} (${C.contenants[o.contenant_id].nom})`,
      `${barre(st / o.quantite)} ${Math.min(st, o.quantite)} / ${o.quantite}${ok ? ' · ✅ prête à livrer' : ''} · **${nb(o.prix_total)} 🪙**`, `à livrer <t:${Math.floor(o.echeance / 1000)}:R>`);
  });
  const finis = e.produits.map(p => `${C.jus[p.jus_id].emoji} **${C.jus[p.jus_id].nom}** (${C.contenants[p.contenant_id].nom}) · ${p.quantite}`);
  return habiller({
    title: `🏭  ${ent.nom}`,
    description: `💰 Solde : **${nb(ent.pieces)} 🪙**` + (e.machines.length ? '' : '\n\n👉 Commence par le bouton **Usine** pour acheter un pressoir et une remplisseuse.'),
    fields: [
      { name: '⏳  Lots en cours', value: bloc(lots, 'Aucun lot en cours') },
      { name: `📦  Stock de fruits · ${nb(e.kgFruits)} / ${nb(ent.capacite_fruits_kg)} kg`, value: bloc(fruits, 'Vide') },
      { name: '🛢️  Cuves', value: bloc(cuves) },
      { name: '⚙️  Machines', value: bloc(machines, 'Aucune machine : va dans **Usine**') },
      { name: '🧴  Contenants vides', value: bloc(vides, 'Aucun') },
      { name: '📋  Bons de commande', value: bloc(commandes, 'Aucune commande : prends un bon dans le salon 🛒-marché') },
      { name: '🍾  Produits finis', value: bloc(finis, 'Aucun') },
    ],
  }, [
    new ActionRowBuilder().addComponents(
      bouton('mf:acheter', '🍎 Acheter des fruits', ButtonStyle.Primary),
      bouton('mf:usine', '🏗️ Usine', ButtonStyle.Primary),
      bouton('mf:pressage', '🧃 Lancer le pressage', ButtonStyle.Success),
      bouton('mf:bouteille', '🍾 Mettre en bouteille', ButtonStyle.Success)),
    new ActionRowBuilder().addComponents(
      bouton('mf:contenants', '📦 Commander des contenants'),
      bouton('mf:vendre', '💰 Vendre au comptoir'),
      bouton('mf:livrer', '📦 Livrer une commande', ButtonStyle.Success),
      bouton('mf:hub', '🔄 Actualiser')),
  ], notice);
}

// ── Sous-écrans (null = rien à proposer) ─────────────────────────────────────
function vueAchatFruits(e) {
  const fruits = Object.values(C.fruits).filter(f => f.debloque_par_defaut);
  return habiller({
    title: '🍎  Acheter des fruits',
    description: `Vendus par caisses de **${C.eq.caisse_kg} kg**.\n🪙 **${nb(e.ent.pieces)}** · 📦 place libre : **${nb(e.ent.capacite_fruits_kg - e.kgFruits)} kg** (stock ${nb(e.kgFruits)} / ${nb(e.ent.capacite_fruits_kg)} kg)`,
  }, [menu('mf:fruit_sel', 'Choisir un fruit…', fruits.map(f => ({
    label: `${f.nom} · ${f.prix_kg} 🪙/kg`, value: f.id, emoji: f.emoji,
    description: `Max ${jeu.maxAchatFruits(e, f.id)} caisse(s) · rend ${f.rendement_l_par_kg} L/kg`,
  }))), retour()]);
}

function vuePressage(e) {
  const fruits = e.fruits.filter(f => C.fruits[f.fruit_id]);
  if (!fruits.length) return null;
  const infoM = Object.values(C.machines).filter(m => m.categorie === 'extraction').map(m => ({ m, s: jeu.machineEtat(e, m.id) })).filter(x => x.s)
    .map(({ m, s }) => item(`${m.emoji} **${m.nom}** · niveau ${s.niveau}${s.occupee ? ' · ⏳ occupé' : ''}`, `**${s.niv.capacite} kg** max par lot · ${duree(s.niv.duree_s)}`)).join('\n\n')
    || '⚠️ Aucun pressoir : achète-en un dans **Usine**.';
  return habiller({
    title: '🧃  Lancer le pressage',
    description: infoM + '\n\n──────────\n\nLe jus est versé dans une cuve compatible à la fin du lot (volume = kg × rendement).',
  }, [menu('mf:press_sel', 'Fruit à presser…', fruits.map(f => {
    const fr = C.fruits[f.fruit_id], m = jeu.maxPressage(e, f.fruit_id);
    return { label: `${fr.nom} · ${nb(f.kg)} kg en stock`, value: f.fruit_id, emoji: fr.emoji,
      description: m.max > 0 ? `Max ${nb(m.max)} kg → ${nb(m.max * m.rend)} L · rend ${fr.rendement_l_par_kg} L/kg` : '⛔ ' + m.raison };
  })), retour()]);
}

function vueBouteille(e) {
  const cuves = e.cuves.filter(c => c.jus_id && c.volume_l > 0);
  if (!cuves.length) return null;
  const infoM = Object.values(C.machines).filter(m => m.categorie === 'conditionnement').map(m => ({ m, s: jeu.machineEtat(e, m.id) })).filter(x => x.s)
    .map(({ m, s }) => item(`${m.emoji} **${m.nom}** · niveau ${s.niveau}${s.occupee ? ' · ⏳ occupée' : ''}`, `**${s.niv.capacite}** contenants max par lot · ${duree(s.niv.duree_s)}`)).join('\n\n')
    || '⚠️ Aucune remplisseuse : achète-en une dans **Usine**.';
  return habiller({
    title: '🍾  Mettre en bouteille',
    description: infoM + '\n\n──────────\n\nÉtape 1/2 — choisis la cuve à embouteiller.',
  }, [menu('mf:bt_cuve', 'Cuve…', cuves.map(c => ({ label: `Cuve n°${c.id} · ${C.jus[c.jus_id].nom}`, value: String(c.id), emoji: C.jus[c.jus_id].emoji,
    description: `${nb(c.volume_l)} L disponibles sur ${nb(c.capacite_l)} L` }))), retour()]);
}

function vueBouteilleContenant(e, cuveId) {
  const cont = Object.values(C.contenants).filter(c => c.debloque_par_defaut);
  const cuve = e.cuves.find(x => x.id === Number(cuveId));
  return habiller({
    title: '🍾  Mettre en bouteille',
    description: `Étape 2/2 — cuve n°${cuveId} : ${cuve && cuve.jus_id ? C.jus[cuve.jus_id].emoji + ' ' + C.jus[cuve.jus_id].nom + ', **' + nb(cuve.volume_l) + ' L** disponibles' : 'vide'}.\nChoisis le contenant.`,
  }, [menu(`mf:bt_cont:${cuveId}`, 'Contenant…', cont.map(c => {
    const m = jeu.maxBouteille(e, cuveId, c.id);
    return { label: c.nom, value: c.id, emoji: c.emoji,
      description: m.max > 0 ? `Max ${m.max} (${nb(m.max * c.volume_l)} L) · ${duree(m.niv.duree_s)} · ${m.vides} vides en stock` : '⛔ ' + m.raison };
  })), retour()]);
}

function vueContenants(e) {
  const cont = Object.values(C.contenants).filter(c => c.debloque_par_defaut);
  return habiller({
    title: '📦  Commander des contenants',
    description: "Bouteilles vides, prix à l'unité.\n🪙 **" + nb(e.ent.pieces) + '** pièces',
  }, [menu('mf:cont_sel', 'Contenant…', cont.map(c => ({
    label: `${c.nom} · ${c.prix_unitaire} 🪙`, value: c.id, emoji: c.emoji,
    description: `${c.volume_l} L · max ${jeu.maxContenants(e, c.id)} avec tes fonds · en stock : ${(e.contenants.find(x => x.contenant_id === c.id) || { quantite: 0 }).quantite}`,
  }))), retour()]);
}

function vueVente(e) {
  if (!e.produits.length) return null;
  const reste = Math.max(0, C.eq.comptoir_limite_l_par_jour - e.venduAujourdhui);
  return habiller({
    title: '💰  Vente au comptoir',
    description: `Prix réduit (**×${C.eq.comptoir_coef}**). Limite du jour : il te reste **${nb(reste)} L** à vendre.`,
  }, [menu('mf:vente_sel', 'Produit à vendre…', e.produits.map(p => {
    const j = C.jus[p.jus_id], c = C.contenants[p.contenant_id];
    return { label: `${j.nom} · ${c.nom} · ${p.quantite} en stock`, description: `${nb(j.prix_vente_l * c.volume_l * c.multiplicateur_vente * C.eq.comptoir_coef)} 🪙 la pièce · max ${jeu.maxVente(e, p.jus_id, p.contenant_id)} aujourd'hui`, value: `${p.jus_id}|${p.contenant_id}`, emoji: j.emoji };
  })), retour()]);
}

function vueUsine(e, notice) {
  const possede = Object.fromEntries(e.machines.map(m => [m.machine_id, m.niveau]));
  const optM = Object.values(C.machines).filter(m => m.debloque_par_defaut).map(m => {
    const niv = possede[m.id];
    if (!niv) return { label: `Acheter ${m.nom} · ${m.prix} 🪙`, description: `Niv. 1 : ${m.niveaux[0].capacite} par lot · ${duree(m.niveaux[0].duree_s)}`, value: `buy:${m.id}`, emoji: m.emoji };
    const suiv = m.niveaux[niv];
    return suiv ? { label: `Améliorer ${m.nom} → niv. ${suiv.niveau} · ${suiv.prix_amelioration} 🪙`, description: `${m.niveaux[niv - 1].capacite} → ${suiv.capacite} par lot · ${duree(m.niveaux[niv - 1].duree_s)} → ${duree(suiv.duree_s)}`, value: `up:${m.id}`, emoji: m.emoji } : null;
  }).filter(Boolean);
  const optC = [
    ...Object.values(C.cuves).map(t => ({ label: `Acheter ${t.nom} · ${t.prix} 🪙`, value: `buy:${t.id}`, description: `${t.capacite_l} L`, emoji: t.emoji })),
    ...e.cuves.map(c => { const t = C.cuves[c.type_cuve]; return { label: `Agrandir cuve n°${c.id} (+${t.amelioration_ajout_l} L) · ${t.amelioration_prix} 🪙`, value: `up:${c.id}`, emoji: '⬆️' }; }),
  ];
  const rows = [];
  if (optM.length) rows.push(menu('mf:usine_m', 'Machines…', optM));
  rows.push(menu('mf:usine_c', 'Cuves…', optC));
  rows.push(new ActionRowBuilder().addComponents(
    bouton('mf:usine_stock', `📦 Agrandir le stock de fruits (+${C.eq.stock_fruits_amelioration_kg} kg · ${C.eq.stock_fruits_amelioration_prix} 🪙)`),
    bouton('mf:hub', '◀ Retour au HUB')));
  return habiller({
    title: '🏗️  Usine',
    description: `🪙 **${nb(e.ent.pieces)}** pièces\nAchète et améliore tes machines et tes cuves.`,
  }, rows, notice);
}

// Panneau « tarifs et économie » : généré depuis data/, donc toujours à jour après un redémarrage de la session locale.
function panneauTarifs() {
  const coef = C.eq.comptoir_coef;
  const fruits = Object.values(C.fruits).filter(f => f.debloque_par_defaut).map(f =>
    item(`${f.emoji} **${f.nom}** — ${nb(f.prix_kg)} 🪙 le kg`, `rend ${nb(f.rendement_l_par_kg)} L par kg`, `donne du ${C.jus[f.jus].nom.toLowerCase()}`));
  const jus = Object.values(C.jus).filter(j => Object.values(C.fruits).some(f => f.jus === j.id && f.debloque_par_defaut)).map(j =>
    item(`${j.emoji} **${j.nom}** — ${nb(j.prix_vente_l)} 🪙 le litre`, `au comptoir : ${nb(j.prix_vente_l * coef)} 🪙 le litre`));
  const cont = Object.values(C.contenants).filter(c => c.debloque_par_defaut).map(c =>
    item(`${c.emoji} **${c.nom}** — ${nb(c.prix_unitaire)} 🪙 la pièce`, `contenance ${nb(c.volume_l)} L`, `prix de vente ×${nb(c.multiplicateur_vente)}`));
  const machines = Object.values(C.machines).filter(m => m.debloque_par_defaut).map(m => item(`${m.emoji} **${m.nom}** — ${nb(m.prix)} 🪙`, ...m.niveaux.map(n =>
    `niveau ${n.niveau} : ${n.capacite} par lot · ${duree(n.duree_s)}${n.bonus_rendement ? ` · +${Math.round(n.bonus_rendement * 100)} % de jus` : ''}${n.prix_amelioration ? ` · amélioration ${nb(n.prix_amelioration)} 🪙` : ''}`)));
  const cuves = Object.values(C.cuves).map(t => item(`${t.emoji} **${t.nom}** — ${nb(t.prix)} 🪙`, `agrandir : +${t.amelioration_ajout_l} L pour ${nb(t.amelioration_prix)} 🪙`))
    .concat(item(`📦 **Stock de fruits** — ${nb(C.eq.stock_fruits_capacite_kg)} kg au départ`, `agrandir : +${C.eq.stock_fruits_amelioration_kg} kg pour ${nb(C.eq.stock_fruits_amelioration_prix)} 🪙`));
  return panneau({
    embeds: [{
      color: COULEUR,
      title: '💶  TARIFS ET ÉCONOMIE · MULTIFRUIT',
      description: `🎁 Capital de départ : **${nb(C.eq.argent_depart)} 🪙** et une cuve offerte.\n\n**Le circuit :** acheter des fruits ➜ presser ➜ cuve ➜ mettre en bouteille ➜ vendre.`,
      fields: [
        { name: `🍎  Fruits · caisses de ${C.eq.caisse_kg} kg`, value: bloc(fruits) },
        { name: '🧃  Jus', value: bloc(jus) },
        { name: '🧴  Contenants', value: bloc(cont) },
        { name: '⚙️  Machines', value: bloc(machines) },
        { name: '🛢️  Cuves et stock', value: bloc(cuves) },
        { name: '💰  Vente au comptoir', value: bloc([
          `Le comptoir paie **${Math.round(coef * 100)} %** du prix du jus.`,
          `Limite : **${C.eq.comptoir_limite_l_par_jour} L par jour** et par entreprise.`,
          'Ta marge = prix de vente − coût des fruits − coût de la bouteille.',
        ]) },
      ],
      footer: { text: "MonCopainBot · Multifruit · valeurs de départ, susceptibles d'évoluer" },
    }],
  });
}

// Panneau des classements (top 10 de chaque catégorie).
const CLASSEMENTS = [
  ['pieces', '🪙  Crédit total', ' 🪙'],
  ['fruits_presses_kg', '🍎  Fruits pressés', ' kg'],
  ['jus_presse_l', '🧃  Jus pressé', ' L'],
  ['bouteilles_generees', '🍾  Bouteilles générées', ''],
  ['bouteilles_vendues', '💰  Bouteilles vendues', ''],
];
function panneauClassements() {
  const medailles = ['🥇', '🥈', '🥉'];
  return panneau({
    embeds: [{
      color: COULEUR,
      title: '🏆  CLASSEMENTS · MULTIFRUIT',
      description: 'Top 10 des entreprises.\nMis à jour toutes les 5 minutes, ou tout de suite avec **Actualiser**.',
      fields: CLASSEMENTS.map(([cle, titre, unite]) => {
        const lignes = jeu.classement(cle).map((r, i) => `${medailles[i] || '▫️'} **${r.nom}** — ${nb(r.valeur)}${unite}`);
        return { name: titre, value: (lignes.length ? lignes.join('\n') : 'Personne pour le moment') + '\n' + SEP };
      }),
      footer: { text: 'MonCopainBot · Multifruit' },
    }],
    components: [new ActionRowBuilder().addComponents(bouton('mf:classement', '🔄 Actualiser'))],
  });
}

// Panneau public du salon hub
function panneauGeneral() {
  return panneau({
    embeds: [{
      color: COULEUR,
      title: '🍹  MULTIFRUIT · HUB GÉNÉRAL',
      description: 'Crée ton **entreprise de jus** : achète des fruits, presse-les, mets le jus en bouteille et vends-le. Améliore ton usine pour produire toujours plus.\n\nConsulte ici les informations du jeu.',
      footer: { text: 'MonCopainBot · Multifruit' },
    }],
    components: [new ActionRowBuilder().addComponents(
      bouton('mf:info_jus', '🧃 Liste des jus'),
      bouton('mf:info_contenants', '🧴 Liste des contenants'),
      bouton('mf:info_machines', '⚙️ Liste des machines'))],
  });
}

const CATEGORIES = { extraction: '🍊 Extraction', traitement: '🧪 Traitement', conditionnement: '🍾 Conditionnement' };
const vueInfoMachines = () => habiller({
  title: '⚙️  Toutes les machines du jeu',
  description: Object.values(C.machines).map(m => {
    const n1 = m.niveaux[0], nm = m.niveaux[m.niveaux.length - 1];
    return item(`${m.emoji} **${m.nom}** · ${nb(m.prix)} 🪙${m.debloque_par_defaut ? '' : ' · 🔒 à débloquer'}`,
      CATEGORIES[m.categorie] || m.categorie,
      `Niv. 1 : ${n1.capacite} par lot · ${duree(n1.duree_s)} — Niv. ${nm.niveau} : ${nm.capacite} par lot · ${duree(nm.duree_s)}`);
  }).join('\n\n').slice(0, 4000),
}, []);

function panneauSalon() {
  return panneau({
    embeds: [{
      color: COULEUR,
      title: '🏭  MON ENTREPRISE',
      description: 'Clique sur le bouton pour ouvrir le HUB de ton entreprise (visible par toi seul).',
      footer: { text: 'MonCopainBot · Multifruit' },
    }],
    components: [new ActionRowBuilder().addComponents(bouton('mf:ouvrir', '🏭 Ouvrir mon HUB', ButtonStyle.Success))],
  });
}

// Infos générales (réponses éphémères depuis le HUB GÉNÉRAL)
const vueInfoJus = () => habiller({
  title: '🧃  Tous les jus du jeu',
  description: Object.values(C.jus).map(j => {
    const f = Object.values(C.fruits).filter(x => x.jus === j.id);
    return item(`${j.emoji} **${j.nom}** · ${nb(j.prix_vente_l)} 🪙/L`,
      f.map(x => `${x.emoji} ${x.nom} : ${nb(x.prix_kg)} 🪙/kg → ${nb(x.rendement_l_par_kg)} L/kg${x.debloque_par_defaut ? '' : ' · 🔒 à débloquer'}`).join(' ; '));
  }).join('\n\n').slice(0, 4000),
}, []);
const vueInfoContenants = () => habiller({
  title: '🧴  Tous les contenants du jeu',
  description: Object.values(C.contenants).map(c =>
    item(`${c.emoji} **${c.nom}** · ${nb(c.volume_l)} L`,
      `${nb(c.prix_unitaire)} 🪙 pièce · vente ×${nb(c.multiplicateur_vente)}`,
      `Machine : ${c.machine_requise ? C.machines[c.machine_requise].nom : '—'}${c.debloque_par_defaut ? '' : ' · 🔒 à débloquer'}`)).join('\n\n').slice(0, 4000),
}, []);

// Panneau du salon 🛒-marché : bons de commande des entreprises fictives, un bouton par bon.
function panneauMarche() {
  const liste = jeu.bons();
  const lignes = liste.map((b, i) => item(`**#${i + 1}** ${C.clients[b.client_id].emoji} **${C.clients[b.client_id].nom}**`,
    `${b.quantite} × ${C.jus[b.jus_id].emoji} ${C.jus[b.jus_id].nom} (${C.contenants[b.contenant_id].nom})`,
    `Récompense : **${nb(b.prix_total)} 🪙**`));
  return panneau({
    embeds: [{
      color: COULEUR,
      title: '🛒  MARCHÉ · BONS DE COMMANDE',
      description: 'Des entreprises cherchent des fournisseurs. **Prends un bon** : il apparaît dans ton HUB et tu as **24 h** pour le livrer.\nStocke tes produits finis, puis livre dès que la commande est complète (bouton **Livrer une commande** du HUB).',
      fields: [{ name: '📋  Bons disponibles', value: bloc(lignes, 'Aucun bon pour le moment') }],
      footer: { text: 'MonCopainBot · Multifruit' },
    }],
    components: liste.length ? [new ActionRowBuilder().addComponents(liste.map((b, i) => bouton(`mf:bon:${b.id}`, `Prendre #${i + 1}`, ButtonStyle.Primary)))] : [],
  });
}

// Livraison : seules les commandes dont le stock est complet sont proposées.
const stockDe = (e, o) => (e.produits.find(p => p.jus_id === o.jus_id && p.contenant_id === o.contenant_id) || { quantite: 0 }).quantite;
function vueLivraison(e) {
  const pretes = e.commandes.filter(o => stockDe(e, o) >= o.quantite);
  if (!pretes.length) return null;
  return habiller({ title: '📦  Livrer une commande', description: "Choisis la commande à livrer (tout est livré d'un coup)." },
    [menu('mf:livrer_sel', 'Commande…', pretes.map(o => ({
      label: `${C.clients[o.client_id].nom} · ${o.quantite} × ${C.jus[o.jus_id].nom}`, description: `+${nb(o.prix_total)} 🪙`, value: String(o.id), emoji: C.clients[o.client_id].emoji,
    }))), retour()]);
}

module.exports = { vueLivraison, panneauMarche, vueHub, vueAchatFruits, vuePressage, vueBouteille, vueBouteilleContenant, vueContenants, vueVente, vueUsine, panneauGeneral, panneauSalon, vueInfoJus, vueInfoContenants, vueInfoMachines, panneauTarifs, panneauClassements };
