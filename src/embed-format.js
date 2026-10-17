// Largeur fixe pour les embeds « panneau » du bot.
//
// Une ligne de 60 « ─ » = la largeur maximale d'un embed Discord (mesurée
// empiriquement). Placée en tête de la description, elle force tous les embeds
// qui l'utilisent à rendre exactement à cette largeur → dimensions identiques
// partout, quelle que soit la quantité de texte.
//
// Ne PAS l'appliquer aux petits messages éphémères d'une ligne (toasts
// « ❌ Introuvable », « ✅ Fait »…) : ça ferait une grande boîte vide.

const SEP = '─'.repeat(60);
const LINE_MAX = 72; // coupe le texte à 72 car. (marge sous les ~80 réels d'une ligne)

// Coupe un texte en lignes <= LINE_MAX, aux espaces (jamais au milieu d'un mot),
// en préservant les sauts de ligne, les préfixes de citation « > » et les
// segments **en gras** (gardés entiers).
function wrap(txt, max = LINE_MAX) {
  return String(txt).split('\n').map(line => {
    const qm = line.match(/^(>\s+)/);
    const prefix = qm ? qm[1] : '';
    const body = qm ? line.slice(prefix.length) : line;
    if (line.length <= max) return line;

    const tokens = body.match(/\*\*[^*]+\*\*[^\s]*|\S+/g) || [];
    const out = [];
    let cur = prefix;
    for (const t of tokens) {
      if (cur.length > prefix.length && (cur + ' ' + t).length > max) {
        out.push(cur);
        cur = prefix + t;
      } else {
        cur = cur.length > prefix.length ? cur + ' ' + t : cur + t;
      }
    }
    if (cur.trim()) out.push(cur);
    return out.join('\n');
  }).join('\n');
}

// Encadre UN embed (objet brut) : ligne SEP en tête de description + texte
// coupé à LINE_MAX.
function panneauEmbed(e) {
  return console_(e);
}

// ── Style « centre de contrôle » ──────────────────────────────────────────────
// Tout panneau est rendu comme le bot-status : cadre ╔═╗ avec le titre, sections ├─, lignes ▸, console ANSI de 50 colonnes.
// Dans un bloc ANSI les mentions ne s'affichent pas : joueurs/rôles/salons sont remplacés par leur nom (cache du bot) ;
// les salons cités sont repris sous le bloc, en lien cliquable.
const W = 50;
const ESC = '\u001b[';
const COUL = { gris: '0;37', cyan: '1;36', vert: '1;32', rouge: '1;31', jaune: '1;33', blanc: '1;37', bleu: '1;34', violet: '1;35' };
const ansi = (c, s) => ESC + COUL[c] + 'm' + s + ESC + '0m';
const B1 = '\u0001', B2 = '\u0002'; // marqueurs de gras, convertis en blanc après le découpage

let _client = null;
function setClient(c) { _client = c; }

// Couleur du cadre d'après la couleur de la barre de l'embed
const cadre = n => ({ 0x2ECC71: 'vert', 0x57F287: 'vert', 0xE74C3C: 'rouge', 0xED4245: 'rouge', 0xF1C40F: 'jaune', 0xE67E22: 'jaune',
  0x5865F2: 'bleu', 0x3498DB: 'bleu', 0x9B59B6: 'violet', 0x95A5A6: 'gris' })[n] || 'cyan';

const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;
const visible = s => s.replace(/[\u0001\u0002]/g, '').length;

// Markdown Discord → texte brut (gras gardé sous forme de marqueurs) ; renvoie aussi les salons cités
function nettoyer(txt, salons) {
  const g = _client?.guilds.cache.first();
  return String(txt)
    .replace(/<@!?(\d+)>/g, (m, id) => '@' + (g?.members.cache.get(id)?.displayName || _client?.users.cache.get(id)?.username || 'joueur'))
    .replace(/<@&(\d+)>/g, (m, id) => '@' + (g?.roles.cache.get(id)?.name.replace(EMOJI, '').trim() || 'rôle'))
    .replace(/<#(\d+)>/g, (m, id) => { salons.add(id); return '#' + (_client?.channels.cache.get(id)?.name.replace(/^[^a-zà-ÿ0-9]+/i, '') || 'salon'); })
    .replace(/<t:(\d+)(?::[a-zA-Z])?>/g, (m, t) => new Date(t * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }))
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, B1 + '$1' + B2)
    .replace(/__([^_]+)__/g, B1 + '$1' + B2)
    .replace(/`([^`]+)`/g, B1 + '$1' + B2)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
}

// Découpe aux espaces en lignes de max caractères visibles (sans couper un mot)
function couper(ligne, max, prefixe = '') {
  const mots = ligne.split(' '), out = [];
  let cur = '';
  for (const m of mots) {
    if (cur && visible(cur + ' ' + m) > max) { out.push(cur); cur = prefixe + m; }
    else cur = cur ? cur + ' ' + m : m;
  }
  out.push(cur);
  return out;
}

// Ligne de texte colorée (le gras repasse en blanc, puis revient à la couleur de base)
function coloree(texte, base) {
  let gras = false;
  return texte.split('\n').map(l => {
    const debut = gras ? ESC + COUL.blanc + 'm' : '';
    gras = (l.match(/\u0001/g) || []).length > (l.match(/\u0002/g) || []).length ? true : (l.includes(B2) && l.lastIndexOf(B2) > l.lastIndexOf(B1)) ? false : gras;
    return ESC + COUL[base] + 'm' + debut + l.replace(/\u0001/g, ESC + COUL.blanc + 'm').replace(/\u0002/g, ESC + COUL[base] + 'm') + ESC + '0m';
  }).join('\n');
}

function console_(e) {
  if (!e) return e;
  const d = String(e.description || '');
  if (d.startsWith('```')) return e; // déjà une console
  const salons = new Set(), out = [];
  const couleur = cadre(e.color);
  const titre = (e.title ? nettoyer(e.title, salons).replace(EMOJI, '').replace(/[\u0001\u0002]/g, '').replace(/\s+/g, ' ').trim() : 'INFORMATION').toUpperCase().slice(0, W - 10);
  out.push(ansi(couleur, '╔' + '═'.repeat(W - 2) + '╗'));
  out.push(ansi(couleur, '║') + ansi('blanc', ('  ◢◤ ' + titre).padEnd(W - 2)) + ansi(couleur, '║'));
  out.push(ansi(couleur, '╚' + '═'.repeat(W - 2) + '╝'));

  const section = nom => out.push(ansi('gris', ' ├─ ') + ansi('jaune', nom.toUpperCase()) + ansi('gris', ' ' + '─'.repeat(Math.max(2, W - 7 - nom.length))));
  const corps = texte => {
    for (const brut of nettoyer(texte, salons).split('\n')) {
      let l = brut.replace(/\s+$/, ''), base = 'gris', pref = ' ', suite = ' ';
      if (!l.trim()) { out.push(''); continue; }
      const kv = /^([^:]{1,24}?)\s*::\s*(.+)$/.exec(l); // « Libellé :: valeur » = ligne ▸ libellé ····· valeur (comme le bot-status)
      if (kv) {
        const lib = kv[1].replace(/[\u0001\u0002]/g, '');
        out.push(' ' + ansi('gris', '▸ ') + ansi('blanc', lib) + ' ' + ansi('gris', '·'.repeat(Math.max(2, 22 - lib.length))) + ' ' + ansi('cyan', kv[2].replace(/[\u0001\u0002]/g, '').slice(0, W - 28)));
        continue;
      }
      const grand = /^#\s+(.*)$/.exec(l); // « # texte » = valeur mise en avant (ex : un code à recopier)
      if (grand) { out.push(ansi('jaune', ' ▌ ' + grand[1].replace(/[\u0001\u0002]/g, ''))); continue; }
      const h = /^#{2,3}\s+(.*)$/.exec(l);
      if (h) { section(h[1].replace(EMOJI, '').replace(/[\u0001\u0002]/g, '').trim()); continue; }
      if (/^-#\s/.test(l)) l = l.replace(/^-#\s+/, '');
      else if (/^>\s?/.test(l)) {
        l = l.replace(/^>\s?/, '');
        if (/^\s*[•\-*]\s+/.test(l)) { l = l.replace(/^\s*[•\-*]\s+/, '▸ '); suite = '   '; base = 'blanc'; }
        else { pref = ' │ '; suite = ' │ '; }
      }
      else if (/^\s*(?:[•\-*]|\d+[.)])\s+/.test(l)) { l = l.replace(/^\s*(?:[•\-*])\s+/, '▸ '); pref = ' '; suite = '   '; base = 'blanc'; }
      else base = 'blanc';
      couper(l, W - 4).forEach((c, i) => out.push(ansi('gris', i ? suite : pref) + coloree(c, base)));
    }
  };

  if (d) corps(d);
  for (const f of e.fields || []) {
    section(String(f.name).replace(EMOJI, '').replace(/​/g, '').trim() || 'DÉTAILS');
    corps(f.value);
  }
  out.push(ansi('gris', ' └' + '─'.repeat(W - 3)));

  let bloc = '```ansi\n' + out.join('\n') + '\n```';
  if (bloc.length > 4000) bloc = bloc.slice(0, 3990).replace(/\n[^\n]*$/, '') + '\n```';
  const liens = [...salons].map(id => '<#' + id + '>').join('  ');
  const { title, fields, ...reste } = e;
  return { ...reste, description: bloc + (liens ? '\n' + liens : '') };
}

// Applique la largeur fixe à chaque embed d'un payload de message.
function panneau(payload) {
  if (!payload || !Array.isArray(payload.embeds)) return payload;
  return { ...payload, embeds: payload.embeds.map(panneauEmbed) };
}

module.exports = { SEP, LINE_MAX, wrap, panneau, panneauEmbed, setClient };
