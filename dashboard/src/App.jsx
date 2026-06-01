import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Config from './pages/Config';
import Logs from './pages/Logs';
import Tickets from './pages/Tickets';
import Login from './pages/Login';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (data.authenticated) setUser(data.user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-400">Chargement...</div>
    </div>
  );

  if (!user) return <Login />;

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/config" element={<Config />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/tickets" element={<Tickets />} />
        </Routes>
      </main>
    </div>
  );
}

function Sidebar({ user }) {
  const loc = useLocation();
  const links = [
    { to: '/dashboard', icon: '📊', label: 'Tableau de bord' },
    { to: '/members',   icon: '👥', label: 'Membres' },
    { to: '/config',    icon: '⚙️',  label: 'Configuration' },
    { to: '/logs',      icon: '📋', label: 'Logs' },
    { to: '/tickets',   icon: '🎫', label: 'Tickets' },
  ];

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="text-xl font-bold text-white">⚔️ DAMOCLES</div>
        <div className="text-sm text-gray-400 mt-1">Dashboard Admin</div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
              loc.pathname === l.to
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}>
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
            className="w-8 h-8 rounded-full" alt="" />
          <span className="text-sm text-white">{user.username}</span>
        </div>
        <a href="/auth/logout"
          className="block text-center text-sm text-gray-400 hover:text-white py-2 px-4 rounded bg-gray-800 hover:bg-gray-700 transition-colors">
          Déconnexion
        </a>
      </div>
    </aside>
  );
}
