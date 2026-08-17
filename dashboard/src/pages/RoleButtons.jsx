import React, { useState, useEffect, useRef } from 'react';

const BUTTON_STYLES = [
  { value: 'Primary',   label: 'Bleu',  color: 'bg-indigo-600' },
  { value: 'Success',   label: 'Vert',  color: 'bg-green-600'  },
  { value: 'Danger',    label: 'Rouge', color: 'bg-red-600'    },
  { value: 'Secondary', label: 'Gris',  color: 'bg-gray-600'   },
];

const EMBED_COLORS = [
  { label: 'Indigo', value: '5865F2' }, { label: 'Vert',   value: '2ECC71' },
  { label: 'Rouge',  value: 'E74C3C' }, { label: 'Orange', value: 'E67E22' },
  { label: 'Bleu',   value: '3498DB' }, { label: 'Violet', value: '9B59B6' },
  { label: 'Or',     value: 'F1C40F' }, { label: 'Blanc',  value: 'FFFFFF' },
];

const EMPTY_FORM = {
  name: '', channelId: '', title: '', description: '',
  imageFile: null, color: '5865F2',
  buttons: [{ roleId: '', label: '', emoji: '', style: 'Primary' }],
};

export default function RoleButtons() {
  const [panels, setPanels]       = useState([]);
  const [roles, setRoles]         = useState([]);
  const [channels, setChannels]   = useState([]);
  const [images, setImages]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('list'); // 'list' | 'form'
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [publishing, setPublishing] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess]     = useState('');
  const [error, setError]         = useState('');
  const fileInputRef              = useRef(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [pa, ro, ch, img] = await Promise.all([
      fetch('/api/role-panels').then(r => r.json()).catch(() => []),
      fetch('/api/roles').then(r => r.json()).catch(() => []),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
      fetch('/api/images').then(r => r.json()).catch(() => []),
    ]);
    setPanels(pa); setRoles(ro); setChannels(ch); setImages(img);
    setLoading(false);
  }

  function openNew() {
    setForm(EMPTY_FORM); setEditId(null);
    setError(''); setSuccess(''); setView('form');
  }

  function openEdit(panel) {
    setForm({
      name:        panel.name,
      channelId:   panel.channelId,
      title:       panel.title,
      description: panel.description,
      imageFile:   panel.imageFile,
      color:       panel.color,
      buttons:     panel.buttons.length ? panel.buttons : [{ roleId: '', label: '', emoji: '', style: 'Primary' }],
    });
    setEditId(panel.id); setError(''); setSuccess(''); setView('form');
  }

  async function savePanel() {
    if (!form.name.trim())    return setError('Le nom est obligatoire.');
    if (!form.channelId)      return setError('Sélectionne un salon.');
    if (!form.buttons.length) return setError('Ajoute au moins un bouton.');
    const invalid = form.buttons.find(b => !b.roleId || !b.label.trim());
    if (invalid)              return setError('Chaque bouton doit avoir un rôle et un texte.');

    setSaving(true); setError('');
    try {
      const url    = editId ? '/api/role-panels/' + editId : '/api/role-panels';
      const method = editId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editId ? 'Panneau modifié !' : 'Panneau créé !');
        await loadAll();
        setTimeout(() => { setView('list'); setSuccess(''); }, 1500);
      } else { setError(data.error || 'Erreur'); }
    } catch (e) { setError('Erreur réseau'); }
    setSaving(false);
  }

  async function publishPanel(id) {
    setPublishing(id); setError(''); setSuccess('');
    try {
      const res  = await fetch('/api/role-panels/' + id + '/publish', { method: 'POST' });
      const data = await res.json();
      if (data.success) { setSuccess('Panneau publié dans Discord !'); await loadAll(); }
      else setError(data.error || 'Erreur publication');
    } catch { setError('Erreur réseau'); }
    setPublishing(null);
    setTimeout(() => setSuccess(''), 4000);
  }

  async function deletePanel(id) {
    if (!confirm('Supprimer ce panneau ?')) return;
    await fetch('/api/role-panels/' + id, { method: 'DELETE' });
    await loadAll();
  }

  async function uploadImage(file) {
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res  = await fetch('/api/images/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        const newImg = { filename: data.filename, url: data.url };
        setImages(imgs => [newImg, ...imgs]);
        setForm(f => ({ ...f, imageFile: data.filename }));
      }
    } catch {}
    setUploading(false);
  }

  function addButton() {
    if (form.buttons.length >= 25) return;
    setForm(f => ({ ...f, buttons: [...f.buttons, { roleId: '', label: '', emoji: '', style: 'Primary' }] }));
  }

  function removeButton(i) {
    setForm(f => ({ ...f, buttons: f.buttons.filter((_, idx) => idx !== i) }));
  }

  function updateButton(i, key, value) {
    setForm(f => ({ ...f, buttons: f.buttons.map((b, idx) => idx === i ? { ...b, [key]: value } : b) }));
  }

  function channelName(id) {
    const ch = channels.find(c => c.id === id);
    return ch ? '#' + ch.name : id || '?';
  }

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }

  const selectedImageObj = images.find(img => img.filename === form.imageFile);

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  // ── VUE LISTE ──────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🎭 Boutons de rôles</h1>
          <p className="text-gray-400 text-sm mt-1">{panels.length} panneau(x) créé(s)</p>
        </div>
        <button onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nouveau panneau
        </button>
      </div>

      {success && <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-3 mb-4 text-sm">✅ {success}</div>}
      {error   && <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">❌ {error}</div>}

      {panels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🎭</div>
            <p>Aucun panneau créé.</p>
            <button onClick={openNew} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline">Créer le premier</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {panels.map(panel => {
            const imgObj = images.find(i => i.filename === panel.imageFile);
            return (
              <div key={panel.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center">

                {/* Miniature image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-gray-700 flex items-center justify-center">
                  {imgObj
                    ? <img src={imgObj.url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-gray-600 text-2xl">🖼️</span>
                  }
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{panel.name}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#' + panel.color }} />
                  </div>
                  <div className="text-gray-500 text-xs space-x-3">
                    <span>📍 {channelName(panel.channelId)}</span>
                    <span>🔘 {panel.buttons.length} bouton(s)</span>
                    <span>📅 Créé le {fmt(panel.createdAt)}</span>
                    {panel.publishedAt && <span className="text-green-500">✅ Publié le {fmt(panel.publishedAt)}</span>}
                  </div>
                  {panel.title && <p className="text-gray-400 text-xs mt-1 truncate">{panel.title}</p>}
                  {/* Aperçu boutons */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {panel.buttons.slice(0, 8).map((b, i) => {
                      const s = BUTTON_STYLES.find(x => x.value === b.style) || BUTTON_STYLES[0];
                      return (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded text-white ${s.color} opacity-80`}>
                          {b.emoji ? b.emoji + ' ' : ''}{b.label}
                        </span>
                      );
                    })}
                    {panel.buttons.length > 8 && <span className="text-gray-600 text-xs">+{panel.buttons.length - 8}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => publishPanel(panel.id)} disabled={publishing === panel.id}
                    className="text-xs bg-indigo-900/30 border border-indigo-800 text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-900/50 disabled:opacity-50 transition-colors">
                    {publishing === panel.id ? '⏳' : '🚀 Publier'}
                  </button>
                  <button onClick={() => openEdit(panel)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors">
                    ✏️ Modifier
                  </button>
                  <button onClick={() => deletePanel(panel.id)}
                    className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-3 py-1.5 rounded hover:bg-red-900/50 transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── VUE FORMULAIRE ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6 flex-shrink-0">
        <button onClick={() => { setView('list'); setError(''); }}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
          ← Retour
        </button>
        <h1 className="text-2xl font-bold text-white">{editId ? '✏️ Modifier le panneau' : '+ Nouveau panneau'}</h1>
      </div>

      {success && <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-3 mb-4 text-sm flex-shrink-0">✅ {success}</div>}
      {error   && <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm flex-shrink-0">❌ {error}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-5">

          {/* Nom + Salon */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">📋 Informations</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Nom du panneau</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Rôles Jeux, Langues, Notifications..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Salon de destination</label>
                <select value={form.channelId} onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Choisir —</option>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}{ch.category ? ' (' + ch.category + ')' : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">🖼️ Image</h2>
            <div onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadImage(f); }}
              className="border-2 border-dashed border-gray-700 rounded-lg p-3 text-center cursor-pointer hover:border-indigo-600 transition-colors mb-3">
              {uploading
                ? <p className="text-gray-400 text-sm">⏳ Upload...</p>
                : <><p className="text-gray-400 text-sm">📤 Clique ou glisse une image</p>
                   <p className="text-gray-600 text-xs mt-0.5">PNG, JPG, GIF, WEBP — 8MB max</p></>}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) uploadImage(f); }} />
            </div>
            {images.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs mb-2">Bibliothèque</p>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                  {images.map(img => (
                    <div key={img.filename}
                      className={`relative rounded cursor-pointer border-2 transition-all ${form.imageFile === img.filename ? 'border-indigo-500' : 'border-transparent hover:border-gray-600'}`}
                      onClick={() => setForm(f => ({ ...f, imageFile: f.imageFile === img.filename ? null : img.filename }))}>
                      <img src={img.url} alt="" className="w-full h-12 object-cover rounded" />
                      {form.imageFile === img.filename && (
                        <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center rounded">
                          <span className="text-white text-sm">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {form.imageFile && <button onClick={() => setForm(f => ({ ...f, imageFile: null }))}
                  className="text-gray-500 hover:text-gray-300 text-xs mt-1">✕ Retirer l'image</button>}
              </div>
            )}
          </div>

          {/* Embed */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">🎨 Contenu</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Titre</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: 🎮 Choisis ton jeu"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Clique sur un bouton pour obtenir le rôle." rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-2">Couleur</label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMBED_COLORS.map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-all ${form.color === c.value ? 'border-white text-white' : 'border-gray-700 text-gray-500'}`}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#' + c.value }} />{c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">🔘 Boutons ({form.buttons.length}/25)</h2>
              <button onClick={addButton} disabled={form.buttons.length >= 25}
                className="text-xs bg-indigo-900/30 border border-indigo-800 text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-900/50 disabled:opacity-40">
                + Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {form.buttons.map((btn, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500 text-xs">Bouton {i + 1}</span>
                    {form.buttons.length > 1 && <button onClick={() => removeButton(i)} className="text-red-400 text-xs">✕</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Rôle</label>
                      <select value={btn.roleId} onChange={e => updateButton(i, 'roleId', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                        <option value="">— Choisir —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Texte</label>
                      <input value={btn.label} onChange={e => updateButton(i, 'label', e.target.value)}
                        placeholder="Ex: Hytale" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Emoji</label>
                      <input value={btn.emoji} onChange={e => updateButton(i, 'emoji', e.target.value)}
                        placeholder="🎮" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Couleur</label>
                      <div className="flex gap-1">
                        {BUTTON_STYLES.map(s => (
                          <button key={s.value} onClick={() => updateButton(i, 'style', s.value)} title={s.label}
                            className={`flex-1 py-1 rounded text-white text-xs font-medium ${s.color} ${btn.style === s.value ? 'ring-1 ring-white' : 'opacity-40 hover:opacity-70'}`}>
                            {s.label[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={savePanel} disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              {saving ? '⏳ Sauvegarde...' : (editId ? '💾 Modifier' : '💾 Sauvegarder')}
            </button>
            <button onClick={() => { setView('list'); setError(''); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition-colors">
              Annuler
            </button>
          </div>
        </div>

        {/* Colonne droite — Aperçu */}
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-0">
            <h2 className="text-white font-semibold mb-4">👁️ Aperçu</h2>
            <div className="bg-[#313338] rounded-xl p-4">
              <div className="flex gap-2">
                <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#' + form.color }} />
                <div className="flex-1 min-w-0">
                  <div className="bg-[#2b2d31] rounded-lg overflow-hidden">
                    {selectedImageObj && (
                      <img src={selectedImageObj.url} alt="" className="w-full max-h-40 object-cover rounded-t-lg" />
                    )}
                    <div className="p-3">
                      {form.title && <div className="text-white font-semibold text-sm mb-1">{form.title}</div>}
                      {form.description && <div className="text-gray-300 text-xs whitespace-pre-wrap">{form.description}</div>}
                      {!form.title && !form.description && !selectedImageObj && (
                        <div className="text-gray-600 text-xs italic">Aperçu de l'embed...</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.buttons.map((btn, i) => {
                      const s = BUTTON_STYLES.find(x => x.value === btn.style) || BUTTON_STYLES[0];
                      return (
                        <div key={i} className={`flex items-center gap-1 px-2.5 py-1 rounded text-white text-xs font-medium ${s.color} opacity-90`}>
                          {btn.emoji && <span>{btn.emoji}</span>}
                          <span>{btn.label || 'Bouton ' + (i + 1)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-gray-600 text-xs">Damoclès Security Bot</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
