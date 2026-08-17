import React, { useState, useEffect } from 'react';

const FEED_TYPES = [
  { value: 'youtube', label: 'YouTube',  icon: '▶️', color: 'text-red-400',    border: 'border-red-800',    bg: 'bg-red-900/20',    placeholder: 'UCxxxxxx (Channel ID) ou @NomChaine' },
  { value: 'reddit',  label: 'Reddit',   icon: '🟠', color: 'text-orange-400', border: 'border-orange-800', bg: 'bg-orange-900/20', placeholder: 'NomDuSubreddit (sans r/)' },
  { value: 'twitch',  label: 'Twitch',   icon: '🟣', color: 'text-purple-400', border: 'border-purple-800', bg: 'bg-purple-900/20', placeholder: 'login_twitch' },
  { value: 'rss',     label: 'RSS/Atom', icon: '📡', color: 'text-blue-400',   border: 'border-blue-800',   bg: 'bg-blue-900/20',   placeholder: 'https://exemple.com/feed.xml' },
];

const INTERVAL_OPTIONS = [
  { label: '5 minutes',  value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 heure',    value: 60 },
  { label: '2 heures',   value: 120 },
  { label: '6 heures',   value: 360 },
  { label: '12 heures',  value: 720 },
];

const EMPTY_FORM = {
  name: '', type: 'youtube', source: '', channelId: '',
  intervalMinutes: 15, enabled: true,
};

export default function Feeds() {
  const [feeds, setFeeds]       = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [checking, setChecking] = useState(null);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    loadAll();
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await fetch('/api/feeds').then(r => r.json());
      setFeeds(Array.isArray(data) ? data : []);
    } catch { setFeeds([]); }
    setLoading(false);
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function openEdit(feed) {
    setForm({
      name:            feed.name,
      type:            feed.type,
      source:          feed.source,
      channelId:       feed.channelId,
      intervalMinutes: feed.intervalMinutes,
      enabled:         feed.enabled,
    });
    setEditId(feed.id);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim())    return setError('Le nom est obligatoire.');
    if (!form.source.trim())  return setError('La source est obligatoire.');
    if (!form.channelId)      return setError('Sélectionne un salon Discord.');
    setSaving(true);
    setError('');
    try {
      const url    = editId ? '/api/feeds/' + editId : '/api/feeds';
      const method = editId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editId ? 'Flux modifié !' : 'Flux créé !');
        setShowForm(false);
        await loadAll();
      } else {
        setError(data.error || 'Erreur inconnue');
      }
    } catch (e) { setError('Erreur réseau : ' + e.message); }
    setSaving(false);
  }

  async function toggleEnabled(feed) {
    await fetch('/api/feeds/' + feed.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...feed, enabled: !feed.enabled }),
    });
    await loadAll();
  }

  async function deleteFeed(id) {
    if (!confirm('Supprimer ce flux ?')) return;
    await fetch('/api/feeds/' + id, { method: 'DELETE' });
    await loadAll();
  }

  async function checkNow(feed) {
    setChecking(feed.id);
    try {
      const res  = await fetch('/api/feeds/' + feed.id + '/check-now', { method: 'POST' });
      const data = await res.json();
      setSuccess(data.success ? 'Vérification lancée pour "' + feed.name + '"' : 'Erreur : ' + (data.error || '?'));
    } catch { setSuccess('Erreur réseau'); }
    setTimeout(() => setSuccess(''), 4000);
    setChecking(null);
    setTimeout(loadAll, 3000);
  }

  function typeInfo(type) {
    return FEED_TYPES.find(t => t.value === type) || FEED_TYPES[0];
  }

  function channelName(id) {
    const ch = channels.find(c => c.id === id);
    return ch ? '#' + ch.name : id || '?';
  }

  function formatInterval(min) {
    if (min < 60)    return min + ' min';
    if (min < 1440)  return (min / 60) + 'h';
    return (min / 1440) + 'j';
  }

  function fmtDate(iso) {
    if (!iso) return 'Jamais';
    return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  }

  const currentType = FEED_TYPES.find(t => t.value === form.type) || FEED_TYPES[0];

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📡 Annonces automatiques</h1>
          <p className="text-gray-400 text-sm mt-1">{feeds.length} flux configuré(s)</p>
        </div>
        <button onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nouveau flux
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-3 mb-4 text-sm flex-shrink-0">
          ✅ {success}
        </div>
      )}

      {/* Légende types */}
      <div className="flex gap-3 mb-5 flex-wrap flex-shrink-0">
        {FEED_TYPES.map(t => (
          <div key={t.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${t.border} ${t.bg} ${t.color}`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Liste */}
      {feeds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>Aucun flux configuré.</p>
            <button onClick={openNew} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline">
              Créer le premier
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {feeds.map(feed => {
            const ti = typeInfo(feed.type);
            return (
              <div key={feed.id}
                className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 ${feed.enabled ? 'border-gray-800' : 'border-gray-800 opacity-60'}`}>

                {/* Icône type */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 border ${ti.border} ${ti.bg}`}>
                  {ti.icon}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm">{feed.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ti.border} ${ti.bg} ${ti.color}`}>
                      {ti.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      feed.enabled
                        ? 'text-green-400 bg-green-900/20 border-green-800'
                        : 'text-gray-500 bg-gray-800 border-gray-700'
                    }`}>
                      {feed.enabled ? '● Actif' : '○ Inactif'}
                    </span>
                    {feed.errorCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full border text-red-400 bg-red-900/20 border-red-800">
                        ⚠️ {feed.errorCount} erreur(s)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span>🔗 {feed.source}</span>
                    <span>📍 {channelName(feed.channelId)}</span>
                    <span>⏱ Toutes les {formatInterval(feed.intervalMinutes)}</span>
                    <span>🕒 Vérifié : {fmtDate(feed.lastChecked)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => checkNow(feed)} disabled={checking === feed.id}
                    className="text-xs bg-indigo-900/30 border border-indigo-800 text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
                    title="Vérifier maintenant">
                    {checking === feed.id ? '⏳' : '🔍 Vérifier'}
                  </button>
                  <button onClick={() => toggleEnabled(feed)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      feed.enabled
                        ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400 hover:bg-yellow-900/50'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                    }`}
                    title={feed.enabled ? 'Désactiver' : 'Activer'}>
                    {feed.enabled ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => openEdit(feed)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    title="Modifier">
                    ✏️
                  </button>
                  <button onClick={() => deleteFeed(feed.id)}
                    className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-3 py-1.5 rounded hover:bg-red-900/50 transition-colors"
                    title="Supprimer">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-white font-bold text-lg">
                {editId ? '✏️ Modifier le flux' : '+ Nouveau flux d\'annonces'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg px-4 py-2 mb-4 text-sm">
                ❌ {error}
              </div>
            )}

            <div className="space-y-4">

              {/* Nom */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Nom du flux</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Chaîne YouTube VANGUARD, r/Hytale..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>

              {/* Type */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Type de source</label>
                <div className="grid grid-cols-2 gap-2">
                  {FEED_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value, source: '' }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        form.type === t.value
                          ? t.border + ' ' + t.bg + ' ' + t.color
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}>
                      <span className="text-lg">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  {form.type === 'youtube' ? 'Channel ID ou @handle YouTube' :
                   form.type === 'reddit'  ? 'Nom du subreddit' :
                   form.type === 'twitch'  ? 'Login Twitch' :
                   'URL du flux RSS/Atom'}
                </label>
                <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder={currentType.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                {/* Aide contextuelle */}
                <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                  {form.type === 'youtube' && <>
                    <p>Trouve le Channel ID sur <span className="text-gray-500">youtube.com/@NomChaine</span> → À propos → Partager → Copier l'ID</p>
                  </>}
                  {form.type === 'reddit' && <p>Ex: <span className="text-gray-500">Hytale</span> pour r/Hytale</p>}
                  {form.type === 'twitch' && <p>Ex: <span className="text-gray-500">vanguard_fr</span> (le nom dans l'URL twitch.tv/...)</p>}
                  {form.type === 'rss' && <p>Ex: <span className="text-gray-500">https://www.reddit.com/r/hytale.rss</span></p>}
                </div>
              </div>

              {/* Salon */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Salon Discord de destination</label>
                <select value={form.channelId} onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Choisir un salon —</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}{ch.category ? ' (' + ch.category + ')' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intervalle */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Fréquence de vérification</label>
                <select value={form.intervalMinutes} onChange={e => setForm(f => ({ ...f, intervalMinutes: parseInt(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {INTERVAL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {form.type === 'twitch' && (
                  <p className="text-yellow-600 text-xs mt-1">⚠️ Twitch sans API key est peu fiable — recommande 5-10 min</p>
                )}
              </div>

              {/* Activé */}
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                  className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.enabled ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-gray-300 text-sm">{form.enabled ? 'Activer immédiatement' : 'Créer en pause'}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Enregistrement...' : (editId ? 'Modifier' : 'Créer le flux')}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
