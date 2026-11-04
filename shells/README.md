# Coques natives (Electron + Capacitor)

Le jeu reste une SPA Vite normale. Les « coques » ne font que charger son build : **aucun code de `src/` ne sait qu'il tourne dans Electron ou Capacitor**. Pas d'iframe (elle compliquerait WebGL, audio et `localStorage` pour rien) : chaque coque est déjà le conteneur.

```
shells/
├── electron/    # fenêtre desktop (mac / windows / linux)
└── capacitor/   # Android + iOS (projets natifs générés par `cap add`)
```

Chaque coque est un paquet autonome (son `package.json`, son `node_modules`) : le jeu n'hérite d'aucune dépendance native. À la première utilisation : `npm install` dans `shells/electron` et `shells/capacitor`.

## Commandes (depuis la racine)

| Commande | Effet |
| --- | --- |
| `npm run electron:dev` | Electron sur le serveur Vite (`npm run dev` dans un autre terminal, port 5173) |
| `npm run electron:start` | build Electron + lancement de l'app |
| `npm run electron:build` | build Electron + installeur (`shells/electron/out`) |
| `npm run cap:sync` | build Capacitor + copie vers `android/` et `ios/` |
| `npm run cap:android` / `cap:ios` | sync + ouverture dans Android Studio / Xcode |

Les builds utilisent des **modes Vite** (`vite build --mode electron|capacitor`) : `vite.config.ts` et le build web (`npm run build`) ne changent pas.

## Pubs : le pattern adapter

`src/rewarded/` : le jeu ne parle qu'à `AdAdapter` (`types.ts`). Le fournisseur se choisit par `VITE_AD_PROVIDER` :

| Valeur | Où |
| --- | --- |
| `crazygames` (défaut) | build web |
| `mock` | développement (fausse pub) |
| `none` | `.env.electron` et `.env.capacitor` : aucune pub, le bouton « ×2 » n'apparaît pas |

Ajouter AdMob = un fichier `admob.ts` qui implémente `AdAdapter` (plugin Capacitor), une entrée dans `ADAPTERS`, et `VITE_AD_PROVIDER=admob` dans `.env.capacitor`.

## Choix techniques

- **Electron : protocole `app://`**, pas `file://`. Sous `file://` Chromium bloque `fetch()`, or three.js charge les `.glb` et l'audio ainsi. `app://game` est aussi une origine stable : la sauvegarde (`localStorage`) persiste d'un lancement à l'autre. `main.mjs` empêche de sortir du dossier du jeu et de naviguer ailleurs ; le renderer est isolé (`contextIsolation`, `sandbox`, pas de Node).
- **Electron : `--base ./`** pour que les assets soient en chemins relatifs.
- **Capacitor : `androidScheme: 'https'`** : origine `https://localhost` stable, pour que la sauvegarde survive aux mises à jour. iOS utilise Swift Package Manager (pas de CocoaPods).

## Prérequis

- Electron : Node 22+.
- Android : **JDK 21** (Capacitor 8), Android SDK, Android Studio.
- iOS : Xcode complet (pas seulement les Command Line Tools), macOS.

## Reste à faire (hors périmètre de cette première version)

- Signature et notarisation macOS, certificats Windows, comptes Apple / Google, icônes et écrans de lancement (`@capacitor/assets`).
- Les polices viennent de Google Fonts (`index.html`) : hors connexion, le jeu retombe sur la police système. À embarquer (`@fontsource`) si l'app doit marcher hors ligne.
- Haptiques natives (`@capacitor/haptics` via `src/shared/haptics.ts`), stockage de sauvegarde plus fiable sur iOS (`@capacitor/preferences` via `src/store/persist.ts`), AdMob.
- Orientation, barre d'état et plein écran Capacitor : à régler selon le design voulu.
