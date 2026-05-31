# 🛡️ Atlas Security Bot — Gestion des inactifs

Bot Discord qui détecte automatiquement les membres n'ayant jamais envoyé de message et leur attribue un rôle **Inactif** chaque semaine.

---

## 📦 Installation

### 1. Prérequis
- [Node.js 18+](https://nodejs.org/) installé sur ta machine
- Un compte Discord avec accès au [Developer Portal](https://discord.com/developers/applications)

---

### 2. Créer le bot sur Discord

1. Va sur https://discord.com/developers/applications
2. Clique **New Application** → donne-lui un nom
3. Onglet **Bot** → clique **Add Bot**
4. Copie le **Token** (garde-le secret !)
5. Active ces **Privileged Gateway Intents** :
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot`, `applications.commands`
   - Permissions : `Manage Roles`, `Read Messages`, `View Channels`, `Read Message History`
7. Copie l'URL générée et ouvre-la pour inviter le bot sur ton serveur

---

### 3. Préparer le serveur Discord

1. Crée un rôle **Inactif** dans ton serveur
2. Crée un salon **#logs-bot** (ou utilise un existant)
3. Active le **Mode Développeur** (Paramètres > Apparence) pour copier les IDs :
   - Clic droit sur le rôle Inactif → **Copier l'ID**
   - Clic droit sur le salon logs → **Copier l'ID**
   - Clic droit sur les rôles à exclure (admin, modo...) → **Copier l'ID**

---

### 4. Configurer le bot

```bash
# Copier le fichier de config
cp .env.example .env
```

Édite `.env` et remplis les valeurs :

```env
DISCORD_TOKEN=ton_token_ici
INACTIVE_ROLE_ID=123456789
LOG_CHANNEL_ID=123456789
EXCLUDED_ROLE_IDS=111111,222222
```

---

### 5. Lancer le bot

```bash
# Installer les dépendances
npm install

# Démarrer
npm start
```

---

## 🔄 Fonctionnement

| Événement | Action |
|-----------|--------|
| Démarrage du bot | Scan immédiat de tous les membres |
| Chaque lundi à 08h00 | Scan automatique hebdomadaire |
| Membre envoie un message | Marqué actif en temps réel |
| Fin de scan | Rapport envoyé dans le salon logs |

**Logique du scan :**
- Parcourt les 100 derniers messages de chaque salon pour détecter les membres actifs
- Attribue le rôle **Inactif** à ceux sans message
- Retire le rôle **Inactif** si un membre est devenu actif
- Ignore les bots et les rôles exclus

---

## ☁️ Hébergement gratuit (Railway)

1. Va sur https://railway.app et connecte ton compte GitHub
2. Push ce projet sur un repo GitHub privé
3. Dans Railway : **New Project > Deploy from GitHub**
4. Ajoute les variables d'environnement dans l'onglet **Variables**
5. Le bot tourne 24h/24 gratuitement (500h/mois offerts)

---

## ⚠️ Limites connues

Discord ne donne pas accès à l'historique complet des messages. Le scan historique est limité aux **100 derniers messages par salon**. Pour une détection parfaite, laisse le bot tourner en continu — il mémorise tous les messages en temps réel.
