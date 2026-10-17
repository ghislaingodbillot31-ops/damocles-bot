import React, { useState, useEffect } from 'react';

const STYLES = [
  { value: 'Primary',   label: 'Bleu',  cls: 'bg-indigo-600' },
  { value: 'Success',   label: 'Vert',  cls: 'bg-green-600' },
  { value: 'Secondary', label: 'Gris',  cls: 'bg-gray-600' },
  { value: 'Danger',    label: 'Rouge', cls: 'bg-red-600' },
];
const styleCls = s => (STYLES.find(x => x.value === s) || STYLES[2]).cls;
const toHex   = n => '#' + (n ?? 0).toString(16).padStart(6, '0');
const fromHex = h => parseInt(h.slice(1), 16);

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500';

// Rendu très simplifié du markdown Discord pour l'aperçu (gras, italique, citations)
function Md({ text }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^&gt; ?(.*)$/gm, '<span class="block border-l-4 border-gray-600 pl-2">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\n/g, '<br>');
  return <div className="text-sm text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Embed({ titre, texte, couleur, image, vide }) {
  return (
    <div className="bg-[#2b2d31] rounded border-l-4 p-3 max-w-xl" style={{ borderColor: toHex(couleur) }}>
      {titre && <div className="text-white font-semibold mb-1">{titre}</div>}
      {texte ? <Md text={texte} /> : <div className="text-sm text-gray-500 italic">{vide}</div>}
      {image && <img src={image} alt="" className="mt-2 rounded max-h-48" />}
    </div>
  );
}

export default function Hubs() {
  const [cfg, setCfg]       = useState(null);
  const [sel, setSel]       = useState('reglement');
  const [etat, setEtat]     = useState('');   // '', 'saving', 'saved', 'publishing', 'published'
  const [erreur, setErreur] = useState('');
  const [modifie, setModifie] = useState(false);

  useEffect(() => { fetch('/api/hub-info').then(r => r.json()).then(setCfg); }, []);

  if (!cfg) return <div className="text-gray-400">Chargement...</div>;

  const bouton = cfg.boutons.find(b => b.key === sel);
  const maj    = patch => { setCfg(c => ({ ...c, ...patch })); setModifie(true); };
  const majBtn = patch => maj({ boutons: cfg.boutons.map(b => b.key === sel ? { ...b, ...patch } : b) });

  async function sauver() {
    setErreur(''); setEtat('saving');
    const r = await fetch('/api/hub-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    if (!r.ok) { setErreur('Sauvegarde impossible (session expirée ?). Recharge la page.'); setEtat(''); return false; }
    setCfg(await r.json()); setModifie(false); setEtat('saved');
    setTimeout(() => setEtat(''), 2500);
    return true;
  }

  async function publier() {
    if (modifie && !(await sauver())) return;
    setErreur(''); setEtat('publishing');
    const r = await fetch('/api/hub-info/publish', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || 'Publication impossible.'); setEtat(''); return; }
    setEtat('published');
    setTimeout(() => setEtat(''), 3000);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-white">HUB d'information</h1>
        <div className="flex gap-2">
          <button onClick={sauver} disabled={etat === 'saving'}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${etat === 'saved' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}>
            {etat === 'saving' ? 'Sauvegarde...' : etat === 'saved' ? '✅ Sauvegardé' : '💾 Sauvegarder'}
          </button>
          <button onClick={publier} disabled={etat === 'publishing'}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${etat === 'published' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white`}>
            {etat === 'publishing' ? 'Publication...' : etat === 'published' ? '✅ Publié sur Discord' : '📢 Publier sur Discord'}
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Ce HUB s'affiche au-dessus du HUB des exploitants. Quand un joueur clique sur un bouton, il reçoit le message réglé ici (visible par lui seul).
        Les textes des boutons sont pris en compte <b className="text-gray-200">dès la sauvegarde</b>. Pour changer l'en-tête ou les boutons affichés, clique sur <b className="text-gray-200">Publier</b>.
      </p>
      {erreur && <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg p-3 mb-4 text-sm">❌ {erreur}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* En-tête du HUB */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-white font-semibold">En-tête du HUB</h2>
            <div>
              <label htmlFor="hub-titre" className="block text-gray-400 text-xs mb-1">Titre</label>
              <input id="hub-titre" className={input} value={cfg.titre} maxLength={256} onChange={e => maj({ titre: e.target.value })} />
            </div>
            <div>
              <label htmlFor="hub-desc" className="block text-gray-400 text-xs mb-1">Texte</label>
              <textarea id="hub-desc" rows={3} className={input} value={cfg.description} maxLength={4000} onChange={e => maj({ description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="hub-couleur" className="text-gray-400 text-xs">Couleur</label>
              <input id="hub-couleur" type="color" value={toHex(cfg.couleur)} onChange={e => maj({ couleur: fromHex(e.target.value) })} className="h-8 w-12 bg-transparent" />
            </div>
          </section>

          {/* Boutons */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">Boutons</h2>
            <div className="flex flex-wrap gap-2 mb-5">
              {cfg.boutons.map(b => (
                <button key={b.key} onClick={() => setSel(b.key)}
                  className={`px-3 py-2 rounded-lg text-sm border ${sel === b.key ? 'border-indigo-500 bg-indigo-600/20 text-white' : 'border-gray-700 text-gray-300 hover:bg-gray-800'} ${b.actif ? '' : 'opacity-50'}`}>
                  {b.label}{!b.message.trim() && <span className="ml-2 text-xs text-yellow-500">vide</span>}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={bouton.actif} onChange={e => majBtn({ actif: e.target.checked })} />
                Afficher ce bouton dans le HUB
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="btn-label" className="block text-gray-400 text-xs mb-1">Texte du bouton (emoji compris)</label>
                  <input id="btn-label" className={input} value={bouton.label} maxLength={80} onChange={e => majBtn({ label: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="btn-style" className="block text-gray-400 text-xs mb-1">Couleur du bouton</label>
                  <select id="btn-style" className={input} value={bouton.style} onChange={e => majBtn({ style: e.target.value })}>
                    {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="btn-titre" className="block text-gray-400 text-xs mb-1">Titre du message</label>
                <input id="btn-titre" className={input} value={bouton.titre} maxLength={256} onChange={e => majBtn({ titre: e.target.value })} />
              </div>
              <div>
                <label htmlFor="btn-msg" className="block text-gray-400 text-xs mb-1">
                  Message envoyé au joueur <span className="text-gray-600">· **gras**, *italique*, &gt; citation · {bouton.message.length}/4000</span>
                </label>
                <textarea id="btn-msg" rows={10} className={input + ' font-mono'} value={bouton.message} maxLength={4000}
                  placeholder="Écris ici ce que le joueur verra en cliquant sur le bouton."
                  onChange={e => majBtn({ message: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 items-end">
                <div className="flex items-center gap-2">
                  <label htmlFor="btn-couleur" className="text-gray-400 text-xs">Couleur du message</label>
                  <input id="btn-couleur" type="color" value={toHex(bouton.couleur)} onChange={e => majBtn({ couleur: fromHex(e.target.value) })} className="h-8 w-12 bg-transparent" />
                </div>
                <div>
                  <label htmlFor="btn-image" className="block text-gray-400 text-xs mb-1">Image (lien https, facultatif)</label>
                  <input id="btn-image" className={input} value={bouton.image} placeholder="https://..." onChange={e => majBtn({ image: e.target.value.trim() })} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Aperçu */}
        <div className="space-y-6 xl:sticky xl:top-0 self-start">
          <section className="bg-[#313338] border border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-gray-400 text-xs uppercase tracking-wider">Aperçu · le HUB dans le salon</h2>
            <Embed titre={cfg.titre} texte={cfg.description} couleur={cfg.couleur} />
            <div className="flex flex-wrap gap-2">
              {cfg.boutons.filter(b => b.actif).map(b => (
                <span key={b.key} className={`${styleCls(b.style)} text-white text-sm px-3 py-1.5 rounded`}>{b.label}</span>
              ))}
            </div>
            <div className="text-xs text-gray-500 pt-1">↓ HUB des exploitants juste en dessous</div>
          </section>
          <section className="bg-[#313338] border border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-gray-400 text-xs uppercase tracking-wider">Aperçu · clic sur « {bouton.label} »</h2>
            <div className="text-xs text-gray-500">👁️ Seul toi peux voir ce message</div>
            <Embed titre={bouton.titre || bouton.label} texte={bouton.message} couleur={bouton.couleur} image={bouton.image}
              vide="Rubrique vide : le joueur verra « Cette rubrique n'est pas encore renseignée »." />
          </section>
        </div>
      </div>
    </div>
  );
}
