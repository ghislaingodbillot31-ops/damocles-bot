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
  return { ...e, description: e && e.description ? SEP + '\n' + wrap(e.description) : SEP };
}

// Applique la largeur fixe à chaque embed d'un payload de message.
function panneau(payload) {
  if (!payload || !Array.isArray(payload.embeds)) return payload;
  return { ...payload, embeds: payload.embeds.map(panneauEmbed) };
}

module.exports = { SEP, LINE_MAX, wrap, panneau, panneauEmbed };
