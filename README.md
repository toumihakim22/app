# ClipBoost

Plateforme de clipping payé à la vue pour le marché algérien. Les agences financent des campagnes, les clippers publient des clips sur leurs propres comptes et sont payés selon les vues validées.

- **Accueil** (`/`) : page publique en Next.js et React.
- **Application** (`/espace`) : connexion par email et mot de passe (inscription avec code par email) ou avec Google, Apple ou Discord, espaces Clipper, Agence et Administration, en français, anglais ou arabe, thème clair, sombre ou celui du système. C'est une page unique en JavaScript générée par `web/build.mjs` dans `public/espace.html`.
- **API** (`/api/...`) : routes Next.js avec base PostgreSQL (Drizzle ORM), comptes, sessions, images et règles de paiement.

## Prérequis

- Node.js 20.9 ou plus récent, et npm.
- Une base PostgreSQL pour la production. En développement, sans `DATABASE_URL`, une base PostgreSQL embarquée (PGlite) est créée dans `.data/` : rien à installer.

## Démarrer en local

```bash
npm install
cp .env.example .env.local       # facultatif en local
ADMIN_EMAIL=admin@clipboost.dz ADMIN_PASSWORD=AdminClip2026 npm run db:seed:demo
npm run dev
```

Ouvrir http://localhost:3000 (accueil) et http://localhost:3000/espace (application).

`db:seed:demo` crée le compte administrateur et des données d'exemple. Les comptes d'exemple ont le mot de passe `Clipboost2026` :

| Compte | Rôle | Ce qu'il montre |
|---|---|---|
| `yacine@clipboost.dz` | Clipper | Gains, retraits, un clip publié sur TikTok et Instagram en un seul envoi |
| `amira@clipboost.dz`, `lina@clipboost.dz` | Clipper | Clips en attente, validés ou refusés |
| `agence@clipboost.dz` | Agence (Tassili Sport) | Campagnes actives et en pause, une campagne refusée avec son motif (à modifier et relancer, ou à supprimer) |
| `hoggar@clipboost.dz` | Agence (Hoggar Boissons) | Campagne en attente de vérification, recharge à confirmer, badge de vérification demandé |
| `djurdjura@clipboost.dz` | Agence (Djurdjura Médias) | Agence vérifiée (badge bleu), campagne active sur YouTube, Facebook et Instagram |

Pour une vraie installation, utilisez `npm run db:seed`, qui crée seulement l'administrateur.

Avec la base embarquée, lancez le seed **avant** `npm run dev` : PGlite n'accepte qu'un processus à la fois.

Sans clé `RESEND_API_KEY`, les codes de vérification sont affichés dans le terminal du serveur, et aussi à l'écran en développement.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (`postgres://…`). **Obligatoire en production.** |
| `RESEND_API_KEY` | Envoi réel des emails (codes d'inscription et de réinitialisation) via [Resend](https://resend.com). |
| `EMAIL_FROM` | Expéditeur des emails, par exemple `ClipBoost <no-reply@clipboost.dz>`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte administrateur créé par `npm run db:seed` (10 caractères minimum). |
| `PGLITE_DIR` | Dossier de la base embarquée en développement (par défaut `.data/pglite`). |
| `APP_URL` | Adresse publique du site, sans `/` final (par exemple `https://clipboost.dz`). Sert aux adresses de retour de Google, Apple et Discord ; à défaut, l'origine de la requête est utilisée (à éviter derrière un proxy). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion avec Google (facultatif). |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Connexion avec Discord (facultatif). |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Connexion avec Apple (facultatif) : Services ID, identifiant d'équipe, identifiant et contenu de la clé privée `.p8` (les retours à la ligne peuvent être écrits `\n`). |

Un bouton « Continuer avec … » n'apparaît que si les variables de son fournisseur sont toutes définies.

## Connexion avec Google, Apple ou Discord

Le parcours (OAuth 2.0 / OpenID Connect, sans dépendance) est dans `lib/server/oauth.ts` : état à usage unique, PKCE (S256) pour Google et Discord, nonce pour Google et Apple, gardés dans un cookie `HttpOnly` de 10 minutes ; l'adresse email doit être vérifiée par le fournisseur. Le compte ClipBoost est retrouvé par le compte du fournisseur déjà relié, sinon par l'adresse email (il est alors relié), sinon créé à l'inscription avec le rôle choisi (Clipper ou Agence). Un compte créé ainsi n'a pas de mot de passe : il peut en définir un dans Paramètres, ou avec « Mot de passe oublié ». Les comptes administrateurs se connectent uniquement avec leur mot de passe ; la suspension, la maintenance et la fermeture des inscriptions s'appliquent comme pour la connexion par mot de passe. En cas d'échec, l'app reçoit `/espace?oauth_error=<code>` et affiche le message correspondant.

Adresses de retour (« redirect URI ») à déclarer chez chaque fournisseur, avec `APP_URL` = votre domaine :

| Fournisseur | Où la déclarer | Adresse de retour |
|---|---|---|
| Google | Google Cloud Console → API et services → Identifiants → ID client OAuth (application Web) | `https://<domaine>/api/auth/oauth/google/callback` |
| Discord | Discord Developer Portal → votre application → OAuth2 → Redirects | `https://<domaine>/api/auth/oauth/discord/callback` |
| Apple | Apple Developer → Identifiers → Services ID → Sign in with Apple → Configure (domaine et « Return URL ») | `https://<domaine>/api/auth/oauth/apple/callback` |

En local, Google et Discord acceptent `http://localhost:3000/api/auth/oauth/<fournisseur>/callback` ; Apple exige un domaine en HTTPS. Apple revient sur le site par un formulaire envoyé depuis `appleid.apple.com` : son cookie de parcours est `SameSite=None; Secure`. Le cookie de parcours est posé sur le domaine où l'utilisateur clique le bouton : servez le site sur le seul domaine de `APP_URL` (redirigez par exemple `www.` vers le domaine principal), sinon le retour du fournisseur ne le retrouve pas (« La connexion a expiré »).

## Mettre en ligne

1. Créer une base PostgreSQL (Neon, Supabase ou un serveur PostgreSQL).
2. Appliquer le schéma et créer l'administrateur :
   ```bash
   DATABASE_URL=postgres://… npm run db:migrate
   DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed
   ```
   À chaque mise à jour, relancez `npm run db:migrate` (migrations SQL de `drizzle/`, appliquées une seule fois). En développement avec la base embarquée, elles s'appliquent au démarrage.
3. Déployer (Vercel ou tout hébergeur Node.js) avec `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` et, si besoin, les identifiants Google, Apple et Discord, puis `npm run build` et `npm start`.

## Images

Photos de profil (tous les comptes), photos de couverture (agences) et photos de campagne sont recadrées et compressées dans le navigateur, puis envoyées en data URL (JPEG, PNG ou WebP, 1,5 Mo au plus). Le serveur vérifie leur contenu (signature du format), les range dans la table `media` de PostgreSQL et les sert à l'adresse `/api/media/<id>`, publique et mise en cache indéfiniment (une image remplacée prend une nouvelle adresse ; l'ancienne est supprimée). Pour un très gros volume, ce stockage pourra passer sur un stockage objet (S3, R2…) sans changer les adresses enregistrées.

## Fichier HTML autonome

```bash
npm run build:offline        # next build, puis web/dist/clipboost-site.html
```

Produit un seul fichier HTML (accueil, connexion, espaces Clipper, Agence et Admin) qui s'ouvre directement depuis le disque, sans serveur ni connexion internet : pratique pour une démonstration. L'API y est simulée dans le navigateur (`web/offline/`) avec les mêmes règles (`lib/server/rules.ts`) et les mêmes contrôles (`lib/server/validation.ts`) que le serveur ; les données sont enregistrées dans le `localStorage` du navigateur.

Au premier lancement, le fichier contient les données d'exemple de `db:seed:demo` et le compte `admin@clipboost.dz` (mot de passe `AdminClip2026`). Les codes de vérification sont affichés à l'écran. Les connexions Google, Apple et Discord y sont simulées (fenêtre de consentement fictive, aucun échange avec le fournisseur), avec les mêmes règles que sur le serveur ; les images sont gardées dans la base du navigateur, et une requête qui dépasserait la place disponible est refusée sans rien perdre des données déjà enregistrées. « Réinitialiser la démo », dans les réglages de l'administration, efface les données du navigateur.

Si l'accueil a déjà été construit (`.next/`), `node web/build.mjs --offline [fichier]` suffit.

## Règles métier

Les réglages sont modifiables par l'administrateur (page « Réglages du site »). Valeurs par défaut :

- **Campagnes** : budget minimum 50 000 DA, commission de 15 % payée par l'agence en plus du budget. À l'approbation, le budget et la commission sont débités du crédit de l'agence ; à la fin de la campagne, le budget non dépensé est rendu avec sa commission.
- **Vérification des campagnes** : une agence peut modifier ou annuler sa campagne tant que l'équipe ne l'a pas examinée. Une campagne refusée l'est avec un motif ; l'agence peut la modifier et la relancer (elle repasse en vérification) ou la supprimer. Une campagne en ligne ne se refuse plus : elle se termine, ce qui rend son budget.
- **Catégories** : 17 catégories proposées, ou « Autre » avec la catégorie précisée par l'agence.
- **Clips** : lien TikTok, Instagram, YouTube ou Facebook obligatoire, unique. Le clipper publie sur toutes les plateformes de la campagne ou sur une seule : un lien par plateforme, enregistrés ensemble (même lot) et examinés séparément. Gain = vues × tarif aux 1 000 vues, nul sous le seuil minimum et limité au plafond par clip. Après validation, le clip continue de rapporter pendant 7 jours, tant que la campagne est active ou en pause : une campagne terminée ne paie plus rien (son budget restant a été rendu à l'agence) et ses clips en attente ne peuvent plus qu'être refusés.
- **Gains** : 3 jours de rétention avant d'être retirables.
- **Retraits** : minimum 2 000 DA vers BaridiMob, CCP ou RIB. Standard gratuit, ou instantané avec 2 % de frais (100 DA minimum).
- **Crédit agence** : demande de recharge (virement, Edahabia, CIB ou carte Visa / Mastercard) avec une référence, confirmée par l'administrateur à réception du paiement. Pour une carte, seuls la marque et les 4 derniers chiffres sont transmis et ajoutés au libellé.
- **Badge de vérification** : une agence le demande (message facultatif) ; l'équipe l'accorde, le refuse avec un motif (l'agence peut redemander) ou le retire. Le badge bleu s'affiche à côté du nom de l'agence.
- **Agences côté clipper** : « Découvrir » présente toutes les campagnes ouvertes ; la page « Agences » liste celles qui les organisent (l'agence propriétaire, ou la marque pour une campagne créée par ClipBoost), puis chaque agence a sa page (`#/clipper/agence/<clé>`) avec sa couverture, son logo, sa présentation et ses projets de clipping. Le clipper ne reçoit que leur profil public (nom, photo, couverture, pays, présentation, date d'inscription, badge de vérification).

Le code des règles est dans `lib/server/rules.ts` et `lib/server/services/`.

## API

Les routes répondent en JSON (`{ ok: true, … }` ou `{ error: "message" }`), sauf les images (`/api/media/<id>`) et les redirections de la connexion Google, Apple ou Discord ; celles qui modifient des données refusent les requêtes venant d'un autre site (sauf le retour d'Apple, protégé par l'état à usage unique du cookie `cb_oauth`). Un corps de requête est limité à 8 Mo.

| Route | Qui | Rôle |
|---|---|---|
| `GET /api/state` | tous | Données visibles par le compte connecté, ou données publiques (dont les fournisseurs de connexion configurés) |
| `POST /api/auth/signup`, `verify`, `login`, `logout`, `forgot`, `reset`, `password` | tous | Comptes et sessions ; `password` définit aussi le premier mot de passe d'un compte créé avec Google, Apple ou Discord |
| `GET /api/auth/oauth/<google\|apple\|discord>?mode=login\|signup&role=clipper\|agence` | tous | Début de la connexion avec un fournisseur (retour sur `…/callback`) |
| `PATCH /api/me` | tous | Profil : nom, photo, couverture (agence), langue, présentation, moyen de retrait… |
| `GET /api/media/<id>` | public | Image envoyée par un utilisateur |
| `POST /api/campaigns` | agence, admin | Nouvelle campagne (photo facultative) |
| `PUT /api/campaigns/<id>` | agence | Modifier une campagne en attente, ou modifier et relancer une campagne refusée |
| `DELETE /api/campaigns/<id>` | agence | Annuler une campagne en attente, ou supprimer une campagne refusée |
| `PATCH /api/campaigns/<id>` | agence, admin | Statut (refus avec `reason`), mise en avant |
| `POST /api/campaigns/<id>/budget`, `…/membership` | agence, clipper | Budget ; rejoindre une campagne, favoris |
| `POST /api/clips` | clipper | Clip : `{ campaignId, title, links: [{ platform, url }] }` |
| `POST /api/clips/<id>/views`, `…/review` | admin | Vues relevées ; validation ou refus |
| `POST /api/credit`, `/api/withdrawals` | agence, clipper | Recharge du crédit ; demande de retrait |
| `POST /api/verification` | agence | Demande du badge de vérification |
| `POST /api/admin/users/<id>/verification` | admin | Badge : `{ decision: "approve" \| "reject" \| "revoke", reason? }` |
| `PATCH /api/admin/users/<id>`, `/api/admin/settings` ; `POST /api/transactions/<id>/review` | admin | Suspension, réglages, retraits et recharges |

## Tests

```bash
npm test                                   # règles de calcul
npm run dev                                # puis, dans un autre terminal :
BASE_URL=http://localhost:3000 npx tsx tests/api-flow.mts   # parcours API complet
```

Le parcours API crée une agence et un clipper, envoie des images, finance et approuve une campagne, en modifie, refuse, relance et supprime une autre, traite une demande de badge, valide un clip publié sur deux plateformes et vérifie les paiements, les rôles et la protection CSRF. Il lit le code de vérification renvoyé en développement : lancez-le contre `npm run dev`, pas contre `npm start`.

## Structure

```
app/                 accueil (React) et routes API
components/landing/  sections de la page d'accueil
lib/server/          base de données, authentification, règles et services
drizzle/             migrations SQL
scripts/             migrate et seed
web/                 application /espace (JavaScript, sans framework) et version autonome (web/offline/)
tests/               tests des règles et du parcours API
```

## Reste à faire avant un lancement public

- Relevé automatique des vues par les API TikTok, Instagram, YouTube et Facebook (aujourd'hui saisies par l'administrateur).
- Paiement en ligne des recharges par carte Edahabia, CIB, Visa ou Mastercard via une passerelle de paiement (aujourd'hui confirmées à la main).
- Vérification de fond des agences avant le badge (documents, registre du commerce).
- Pages « Mentions légales » et « Aide et support » du menu du compte.
- Liaison vérifiée des comptes sociaux des clippers.
- Pages légales (CGU, confidentialité) validées par un juriste.
