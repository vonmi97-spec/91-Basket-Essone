# Organisation du code (version 5.0)

`index.html` contient seulement la structure ; le style et le code sont découpés :

- `css/app.css` — composants de base · `css/design.css` — design v5 (navigation du bas, accueil, page Plus, thèmes)
- `js/00-boot.js` — écran d'ouverture et thème (chargé en premier)
- `js/01-core.js` — config, stockage, accès FFBB, normalisation des matchs, logos
- `js/02-ui-base.js` — état, filtres, carte de match, rendu principal
- `js/03-classements.js` … `js/16-victoire.js` — classements, analyses, notifications, favoris, direct, saison, styles, probabilités
- `js/17-nouveautes.js` — historique des versions (pop-up « Nouveautés »)
- `js/18-fiche-match.js` à `js/21-rafraichir.js` — fiche match, événements, recherche, rafraîchissement + démarrage instantané
- `js/30-navigation.js` — barre du bas, sous-onglets, page « Plus »
- `js/99-demarrage.js` — lancement

Les fichiers sont des scripts classiques chargés dans l'ordre (portée globale partagée).
