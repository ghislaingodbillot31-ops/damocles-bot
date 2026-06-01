import React, { useState, useEffect } from 'react';

export default function Tickets() {
  const [config, setConfig] = useState({
    TICKET_SUPPORT_ROLE_ID: '',
    TICKET_CATEGORY_ID: '',
    TICKET_LOG_CHANNEL_ID: '',
    TICKET_CHANNEL_ID: '',
    TICKET_MAX_PER_USER: 1,
    TICKET_BUTTON_LABEL: '🎫 Ouvrir un ticket',
    TICKET_BUTTON_COLOR: 'Primary',
    TICKET_MESSAGE: 'Entre en contact avec le staff du serveur.',
    TICKET_WELCOME: 'Merci pour ton ticket ! Merci de nous donner le maximum d\'informations. Un responsable s\'occupera de toi.',
    TICKET_ENABLED: true,
  });
  const [roles, setRoles] = useState([]);
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then(r => r.json()),
      fetch('/api/roles').then(r => r.json()).catch(() => []),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
      fetch('/api/categories').then(r => r.json()).catch(() => []),
      fetch('/api/tickets').then(r => r.json()).catch(() => []),
    ]).then(([cfg, ro, ch, cat, tk]) => {
      setConfig(c => ({ ...c, ...cfg }));
      setRoles(ro);
      setChannels(ch);
      setCategories(cat);
      setTickets(tk);
    });
  }, []);

  async function save() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function publish() {
    setPublishing(true);
    const res = await fetch('/api/tickets/publish', { method: 'POST' });
    const data = await res.json();
    setPublishing(false);
    if (data.success) { setPublished(true); setTimeout(() => setPublished(false), 4000); }
  }

  async function closeTicket(ticketId) {
    await fetch('/api/tickets/' + ticketId + '/close', { method: 'POST' });
    setTickets(t => t.map(tk => tk.id === ticketId ? { ...tk, status: 'closed' } : tk));
  }

  const BUTTON_COLORS = [
    { value: 'Primary', label: 'Bleu', color: 'bg-indigo-600' },
    { value: 'Success', label: 'Vert', color: 'bg-green-600' },
    { value: 'Danger',  label: 'Rouge', color: 'bg-red-600' },
    { value: 'Secondary', label: 'Gris', color: 'bg-gray-600' },
  ];

  const STATUS_STYLE = {
    open:   'text-blue-400 bg-blue-900/20 border-blue-800',
    taken:  'text-green-400 bg-green-900/20 border-green-800',
    closed: 'text-gray-400 bg-gray-800 border-gray-700',
  };
  const STATUS_LABEL = { open: '🎫 Ouvert', taken: '✋ Pris en charge', closed: '🔒 Clôturé' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Système de tickets</h1>
          <p className="text-gray-400 text-sm mt-1">Configurer et gérer les tickets de support</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-gray-400 text-sm">Activer</span>
            <div onClick={() => setConfig(c => ({ ...c, TICKET_ENABLED: !c.TICKET_ENABLED }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${config.TICKET_ENABLED ? 'bg-indigo-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.TICKET_ENABLED ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {[{ id: 'config', label: '⚙️ Configuration' }, { id: 'tickets', label: '🎫 Tickets ouverts' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div className="space-y-6">

          {/* Paramètres généraux */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">📋 Paramètres généraux</h2>
            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className="block text-gray-400 text-xs mb-1">Rôle responsable des tickets</label>
                <select value={config.TICKET_SUPPORT_ROLE_ID || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_SUPPORT_ROLE_ID: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Sélectionner un rôle —</option>
                  {roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Catégorie des tickets</label>
                <select value={config.TICKET_CATEGORY_ID || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_CATEGORY_ID: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Sélectionner une catégorie —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Salon où publier le bouton</label>
                <select value={config.TICKET_CHANNEL_ID || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_CHANNEL_ID: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Sélectionner un salon —</option>
                  {channels.map(c => <option key={c.id} value={c.id}>[{c.category || '—'}] #{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Salon de logs tickets</label>
                <select value={config.TICKET_LOG_CHANNEL_ID || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_LOG_CHANNEL_ID: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Sélectionner un salon —</option>
                  {channels.map(c => <option key={c.id} value={c.id}>[{c.category || '—'}] #{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Nombre max de tickets par joueur</label>
                <input type="number" min="1" max="5"
                  value={config.TICKET_MAX_PER_USER || 1}
                  onChange={e => setConfig(c => ({ ...c, TICKET_MAX_PER_USER: parseInt(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>

            </div>
          </div>

          {/* Message & bouton */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">🎨 Message & bouton</h2>
            <div className="space-y-4">

              <div>
                <label className="block text-gray-400 text-xs mb-1">Message affiché avec le bouton</label>
                <textarea value={config.TICKET_MESSAGE || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_MESSAGE: e.target.value }))}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Entre en contact avec le staff du serveur." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Texte du bouton</label>
                  <input value={config.TICKET_BUTTON_LABEL || ''}
                    onChange={e => setConfig(c => ({ ...c, TICKET_BUTTON_LABEL: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="🎫 Ouvrir un ticket" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Couleur du bouton</label>
                  <div className="flex gap-2">
                    {BUTTON_COLORS.map(b => (
                      <button key={b.value} onClick={() => setConfig(c => ({ ...c, TICKET_BUTTON_COLOR: b.value }))}
                        className={`flex-1 py-2 rounded-lg text-white text-xs font-medium transition-all ${b.color} ${config.TICKET_BUTTON_COLOR === b.value ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Message d'accueil dans le ticket</label>
                <textarea value={config.TICKET_WELCOME || ''}
                  onChange={e => setConfig(c => ({ ...c, TICKET_WELCOME: e.target.value }))}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Merci pour ton ticket ! Un responsable s'occupera de toi." />
              </div>

              {/* Aperçu */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Aperçu</label>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-gray-300 text-sm mb-3">{config.TICKET_MESSAGE || 'Entre en contact avec le staff.'}</p>
                  <button className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
                    config.TICKET_BUTTON_COLOR === 'Success' ? 'bg-green-600' :
                    config.TICKET_BUTTON_COLOR === 'Danger'  ? 'bg-red-600'   :
                    config.TICKET_BUTTON_COLOR === 'Secondary' ? 'bg-gray-600' : 'bg-indigo-600'
                  }`}>
                    {config.TICKET_BUTTON_LABEL || '🎫 Ouvrir un ticket'}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={save}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}>
              {saved ? '✅ Sauvegardé !' : '💾 Enregistrer les modifications'}
            </button>
            <button onClick={publish} disabled={publishing || !config.TICKET_CHANNEL_ID}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${published ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
              {publishing ? '⏳ Publication...' : published ? '✅ Publié !' : '🚀 Publier dans le salon'}
            </button>
          </div>

        </div>
      )}

      {activeTab === 'tickets' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Ouverts',        value: tickets.filter(t => t.status === 'open').length,   color: 'text-blue-400',  icon: '🎫' },
              { label: 'Pris en charge', value: tickets.filter(t => t.status === 'taken').length,  color: 'text-green-400', icon: '✋' },
              { label: 'Clôturés',       value: tickets.filter(t => t.status === 'closed').length, color: 'text-gray-400',  icon: '🔒' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span>{s.icon}</span>
                  <span className="text-gray-400 text-sm">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 px-4 py-3 text-xs text-gray-500 uppercase border-b border-gray-800">
              <div>Ticket</div><div>Membre</div><div>Statut</div><div>Créé le</div><div>Action</div>
            </div>
            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">Aucun ticket enregistré</div>
              ) : tickets.map(t => (
                <div key={t.id} className="grid grid-cols-5 px-4 py-3 items-center text-sm hover:bg-gray-800/30">
                  <div className="text-white font-mono text-xs truncate">{t.channelName || t.id}</div>
                  <div className="text-gray-300 text-xs truncate">@{t.username || t.userId}</div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLE[t.status] || STATUS_STYLE.open}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </div>
                  <div>
                    {t.status !== 'closed' && (
                      <button onClick={() => closeTicket(t.id)}
                        className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-3 py-1 rounded hover:bg-red-900/50 transition-colors">
                        🔒 Clôturer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
