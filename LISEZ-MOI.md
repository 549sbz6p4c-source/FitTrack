# FITTRACK — PWA pour iPhone (GitHub Pages)

Application 100 % locale : toutes tes données restent dans IndexedDB, sur ton iPhone. Aucun compte, aucun serveur, aucune synchronisation.
Version de départ : **FITTRACK_iphone_7.html** (code de l'appli inchangé : `js/app.js`, `js/database.js`, `js/calculations.js` sont identiques à la v7).

## 1. Publier sur GitHub Pages (une seule fois)
1. Crée un compte sur github.com, puis **New repository** : nom `fittrack`, visibilité **Public** (obligatoire pour GitHub Pages gratuit).
2. **Add file → Upload files** : glisse **tout le contenu de ce dossier** (index.html, manifest.json, sw.js, css/, js/, icons/, tools/) en gardant les sous-dossiers. Valide avec **Commit changes**.
3. **Settings → Pages** : *Source* = *Deploy from a branch*, branche `main`, dossier `/ (root)` → **Save**.
4. Après 1 à 2 minutes, ton appli est à `https://TON-PSEUDO.github.io/fittrack/`.

> Le dépôt est public, mais il ne contient que le code, jamais tes données. Ne change plus ensuite le nom du dépôt ni ton pseudo : l'adresse changerait et l'iPhone verrait une appli vide (les données sont liées à l'adresse).

## 2. Installer sur l'iPhone
1. Ouvre l'adresse dans **Safari**, **avec Internet**, et attends quelques secondes (premier chargement : l'appli se met en cache).
2. **Partager → Sur l'écran d'accueil → Ajouter**.
3. Lance FITTRACK **depuis l'icône** (plein écran, sans barre Safari). Ensuite elle marche sans connexion (test : mode avion).

**Important** : Safari et l'icône de l'écran d'accueil ont chacun leur propre stockage sur iOS. Si tu as déjà des données dans un onglet Safari : *Profil → Exporter tout (JSON)* dans Safari, puis *Profil → Restaurer* dans l'appli installée.

## 3. Mettre à jour sans perdre tes données
1. Modifie les fichiers voulus (ex. nouvelle version de `js/app.js`).
2. Lance `python3 tools/release.py` : il recalcule la version dans `sw.js` (sans Python : change à la main `const VERSION = '…'` dans `sw.js`).
3. Sur GitHub, envoie les fichiers modifiés **y compris `sw.js`** (Add file → Upload files, même noms = remplacement).
4. Sur l'iPhone, ouvre l'appli avec du réseau : un bandeau **« Nouvelle version disponible »** apparaît. Touche **Mettre à jour** (ou **Plus tard** : rien ne se recharge en pleine séance).

Le service worker ne touche jamais à IndexedDB : une mise à jour remplace le code, pas les données. L'ancien cache est supprimé automatiquement.

## 4. Sauvegarde
*Profil → Exporter tout (JSON)*. Un rappel discret apparaît après 14 jours sans export (reportable 3 jours). La restauration fusionne sans doublons et demande confirmation.

## 5. Limites iOS à connaître
- **Données** : iOS peut effacer les données d'un site Safari non installé après environ 7 jours sans visite. L'appli installée est mieux protégée, mais rien n'est garanti : fais des sauvegardes JSON. Supprimer l'icône supprime aussi ses données.
- **Écran verrouillé / appli en arrière-plan** : iOS suspend la page. Les chronos restent exacts (calculés sur l'heure réelle), mais le bip de fin de repos n'arrive qu'au retour dans l'appli.
- **Premier chargement** : il doit se faire en ligne. Les mises à jour aussi.
- **Détection des mises à jour** : au lancement et au retour dans l'appli (au plus toutes les 10 minutes). Un redémarrage complet de l'appli est parfois nécessaire.
- Pas d'écran de démarrage personnalisé (iOS génère le sien à partir de l'icône). Pas de notifications push.
- **Confidentialité** : GitHub voit les visites comme pour n'importe quel site (adresse IP, heure) quand ton iPhone télécharge les fichiers. Aucune donnée de l'appli n'est envoyée : une politique de sécurité (CSP) interdit toute connexion vers l'extérieur.
