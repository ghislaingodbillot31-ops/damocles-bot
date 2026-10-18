import React, { useState, useEffect } from 'react';

const INTERVAL_OPTIONS = [
  { label: '30 minutes',  value: 30 },
  { label: '1 heure',     value: 60 },
  { label: '2 heures',    value: 120 },
  { label: '4 heures',    value: 240 },
  { label: '6 heures',    value: 360 },
  { label: '12 heures',   value: 720 },
  { label: '24 heures',   value: 1440 },
  { label: '48 heures',   value: 2880 },
  { label: '7 jours',     value: 10080 },
];

const COLOR_OPTIONS = [
  { label: 'Indigo',  value: '5865F2' },
  { label: 'Vert',    value: '2ECC71' },
  { label: 'Rouge',   value: 'E74C3C' },
  { label: 'Orange',  value: 'E67E22' },
  { label: 'Bleu',    value: '3498DB' },
  { label: 'Violet',  value: '9B59B6' },
  { label: 'Gris',    value: '95A5A6' },
];

const EMPTY_FORM = {
  name: '',
  channelId: '',
  message: '',
  intervalMinutes: 60,
  color: '5865F2',
  enabled: true,
};

export default function Messages() {
  const [messages, setMessages]   = useState([]);
  const [channels, setChannels]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  useEffect(() => {
    loadAll();
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await fetch('/api/scheduled-messages').then(r => r.json());
      setMessages(Array.isArray(data) ? data : []);
    } catch { setMessages([]); }
    setLoading(false);
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function openEdit(msg) {
    setForm({
      name:            msg.name || '',
      channelId:       msg.channelId || '',
      message:         msg.message || '',
      intervalMinutes: msg.intervalMinutes || 60,
      color:           msg.color || '5865F2',
      enabled:         msg.enabled !== false,
    });
    setEditId(msg.id);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim())    return setError('Le nom est obligatoire.');
    if (!form.channelId)      return setError('Sélectionne un salon.');
    if (!form.message.trim()) return setError('Le message est obligatoire.');

    setSaving(true);
    setError('');
    try {
      const url    = editId ? '/api/scheduled-messages/' + editId : '/api/scheduled-messages';
      const method = editId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editId ? 'Message modifié !' : 'Message créé !');
        setShowForm(false);
        await loadAll();
      } else {
        setError(data.error || 'Erreur inconnue');
      }
    } catch (e) {
      setError('Erreur réseau : ' + e.message);
    }
    setSaving(false);
  }

  async function toggleEnabled(msg) {
    await fetch('/api/scheduled-messages/' + msg.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...msg, enabled: !msg.enabled }),
    });
    await loadAll();
  }

  async function deleteMsg(id) {
    if (!confirm('Supprimer ce message récurrent ?')) return;
    await fetch('/api/scheduled-messages/' + id, { method: 'DELETE' });
    await loadAll();
  }

  async function sendNow(id) {
    const res  = await fetch('/api/scheduled-messages/' + id + '/send-now', { method: 'POST' });
    const data = await res.json();
    setSuccess(data.success ? 'Message envoyé !' : ('Erreur : ' + (data.error || '?')));
    setTimeout(() => setSuccess(''), 3000);
  }

  function formatInterval(min) {
    if (min < 60)   return min + ' min';
    if (min < 1440) return (min / 60) + 'h';
    if (min < 10080) return (min / 1440) + 'j';
    return (min / 10080) + ' sem.';
  }

  function channelName(id) {
    const ch = channels.find(c => c.id === id);
    return ch ? '#' + ch.name : id || '?';
  }

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📢 Messages récurrents</h1>
          <p className="text-gray-400 text-sm mt-1">{messages.length} message(s) planifié(s)</p>
        </div>
        <button onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nouveau message
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-3 mb-4 text-sm">
          ✅ {success}
        </div>
      )}

      {/* Liste */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>Aucun message récurrent configuré.</p>
            <button onClick={openNew} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline">
              Créer le premier
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {messages.map(msg => (
            <div key={msg.id}
              className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 ${msg.enabled ? 'border-gray-800' : 'border-gray-800 opacity-60'}`}>

              {/* Couleur indicateur */}
              <div className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: '#' + (msg.color || '5865F2') }} />

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm">{msg.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    msg.enabled
                      ? 'text-green-400 bg-green-900/20 border-green-800'
                      : 'text-gray-500 bg-gray-800 border-gray-700'
                  }`}>
                    {msg.enabled ? '● Actif' : '○ Inactif'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>📍 {channelName(msg.channelId)}</span>
                  <span>⏱ Toutes les {formatInterval(msg.intervalMinutes)}</span>
                  {msg.lastSent && <span>🕒 Dernier envoi : {new Date(msg.lastSent).toLocaleString('fr-FR')}</span>}
                  {msg.nextSend && <span>⏭ Prochain : {new Date(msg.nextSend).toLocaleString('fr-FR')}</span>}
                </div>
                <p className="text-gray-400 text-xs mt-1.5 truncate">{msg.message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => sendNow(msg.id)}
                  className="text-xs bg-indigo-900/30 border border-indigo-800 text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-900/50 transition-colors"
                  title="Envoyer maintenant">
                  ▶ Envoyer
                </button>
                <button onClick={() => toggleEnabled(msg)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    msg.enabled
                      ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400 hover:bg-yellow-900/50'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                  title={msg.enabled ? 'Désactiver' : 'Activer'}>
                  {msg.enabled ? '⏸' : '▶'}
                </button>
                <button onClick={() => openEdit(msg)}
                  className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                  title="Modifier">
                  ✏️
                </button>
                <button onClick={() => deleteMsg(msg.id)}
                  className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-3 py-1.5 rounded hover:bg-red-900/50 transition-colors"
                  title="Supprimer">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-white font-bold text-lg">
                {editId ? '✏️ Modifier le message' : '+ Nouveau message récurrent'}
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
                <label className="block text-gray-400 text-xs mb-1">Nom (pour s'y retrouver)</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Annonce règlement, Boost serveur..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>

              {/* Salon */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Salon de destination</label>
                <select value={form.channelId} onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">-- Choisir un salon --</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}{ch.category ? ' (' + ch.category + ')' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intervalle */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Intervalle d'envoi</label>
                <select value={form.intervalMinutes} onChange={e => setForm(f => ({ ...f, intervalMinutes: parseInt(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Couleur embed */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Couleur de l'embed</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        form.color === c.value ? 'border-white text-white' : 'border-gray-700 text-gray-400'
                      }`}>
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#' + c.value }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Contenu du message</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Contenu du message Discord (markdown supporté)"
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none font-mono" />
                <p className="text-gray-600 text-xs mt-1">{form.message.length} caractères</p>
              </div>

              {/* Activé */}
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                  className={`w-10 h-6 rounded-full transition-colors ${form.enabled ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-gray-300 text-sm">{form.enabled ? 'Actif dès la création' : 'Créer en pause'}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Enregistrement...' : (editId ? 'Modifier' : 'Créer le message')}
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
