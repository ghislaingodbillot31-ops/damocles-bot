import React from 'react';

export default function Login() {
  const error = new URLSearchParams(window.location.search).get('error');

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center max-w-md w-full">
        <div className="text-5xl mb-4">⚔️</div>
        <h1 className="text-2xl font-bold text-white mb-2">DAMOCLES</h1>
        <p className="text-gray-400 mb-8">Panneau d'administration sécurisé</p>
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg p-3 mb-6 text-sm">
            {error === 'unauthorized' ? '❌ Accès refusé — compte non autorisé' : '❌ Erreur d\'authentification'}
          </div>
        )}
        <a href="/auth/login"
          className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.12 18.12a19.916 19.916 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.81 13.81 0 0 0 1.226-1.963.072.072 0 0 0-.041-.099 13.134 13.134 0 0 1-1.872-.878.073.073 0 0 1-.007-.124c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.073.073 0 0 1-.006.124 12.5 12.5 0 0 1-1.873.877.072.072 0 0 0-.041.1c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-2.981.076.076 0 0 0 .032-.027c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Se connecter avec Discord
        </a>
      </div>
    </div>
  );
}
