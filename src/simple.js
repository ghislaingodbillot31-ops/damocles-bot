// Réponses aux clics (boutons, menus, formulaires, commandes) : texte simple, sans cadre, sans icône ni caractère spécial.
// Les panneaux publiés dans les salons gardent le design console ; seules les réponses visibles par le joueur seul sont simplifiées.
const D = require('discord.js');

const ANSI = /\u001b\[[0-9;]*m/g;
const ICONES = /[\p{Extended_Pictographic}\p{Regional_Indicator}️‍⃣]/gu;

// Texte brut : retire le décor ANSI du design console, les icônes et les symboles
function simplifier(texte) {
  return String(texte)
    .replace(ANSI, '').replace(/```(?:ansi)?\n?/g, '')
    .split('\n')
    .map(l => {
      if (/^\s*[╔╚]/.test(l) || /^\s*└/.test(l)) return null;                    // cadres et fermeture
      const titre = /^\s*║\s*◢◤\s*(.*?)\s*║?\s*$/.exec(l);
      if (titre) return titre[1].replace(/\s+(OK|ÉCHEC|\.\.\.)\s*$/, '') || null;      // titre du panneau
      const section = /^\s*├─\s*(.*?)\s*─*\s*$/.exec(l);
      if (section) return section[1];                                               // titre de section
      return l.replace(/^\s*[▸▌│]\s?/, '').replace(/\s*·{2,}\s*/, ' : ');             // puces et lignes « libellé ··· valeur »
    })
    .filter(l => l !== null)
    .map(l => l.trim())
    .join('\n')
    .replace(ICONES, '').replace(/[◢◤▸▌│═─]/g, '')
    .replace(/ · /g, ' - ').replace(/·/g, '-')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// Charge utile simplifiée : les embeds deviennent du texte dans « content », les boutons et menus sont gardés
function simple(payload) {
  if (typeof payload === 'string') return simplifier(payload) || '-';
  if (!payload || typeof payload !== 'object') return payload;
  const textes = [payload.content ? simplifier(payload.content) : ''];
  const images = [];
  for (const e of payload.embeds || []) {
    const o = e.toJSON ? e.toJSON() : e;
    const t = o.title ? simplifier(o.title) : '', d = o.description ? simplifier(o.description) : '';
    if (t && !d.toLowerCase().startsWith(t.toLowerCase())) textes.push(t); // pas de titre répété dans le texte
    if (d) textes.push(d);
    for (const f of o.fields || []) textes.push(simplifier(f.name).replace(/​/g, '') + ' : ' + simplifier(f.value));
    if (o.image?.url) images.push({ image: { url: o.image.url } });
  }
  const content = textes.filter(Boolean).join('\n\n').slice(0, 2000);
  const { embeds, ...reste } = payload;
  return { ...reste, content: content || '-', ...(images.length ? { embeds: images } : { embeds: [] }) };
}

const EPHEMERE = 64;

// Applique la simplification aux réponses éphémères des interactions (reply, editReply, followUp, update)
function installer() {
  for (const nom of ['CommandInteraction', 'MessageComponentInteraction', 'ModalSubmitInteraction']) {
    const proto = D[nom]?.prototype;
    if (!proto) continue;
    for (const m of ['reply', 'editReply', 'followUp', 'update']) {
      const origine = proto[m];
      if (typeof origine !== 'function') continue;
      proto[m] = function (payload, ...suite) {
        // reply/followUp : éphémère si le drapeau est posé ; editReply : si la réponse différée l'était ; update : si le message l'est
        const eph = m === 'update' ? (this.message?.flags?.has?.(EPHEMERE) ?? false)
          : m === 'editReply' ? !!this.ephemeral || (typeof payload === 'object' && !!(Number(payload?.flags) & EPHEMERE))
          : typeof payload === 'object' && !!(Number(payload?.flags) & EPHEMERE);
        if (payload && payload.natif) { const { natif, ...p } = payload; return origine.call(this, p, ...suite); } // `natif: true` : l'embed est gardé tel quel
        return origine.call(this, eph ? simple(payload) : payload, ...suite);
      };
    }
  }
}

module.exports = { installer, simple, simplifier };
