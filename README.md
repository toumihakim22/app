# ClipBoost

Plateforme de clipping payé à la vue pour le marché algérien. Les agences financent des campagnes, les clippers publient des clips sur leurs propres comptes et sont payés selon les vues validées.

- **Accueil** (`/`) : page publique en Next.js et React.
- **Application** (`/espace`) : connexion, inscription avec code par email, espaces Clipper, Agence et Administration, mode sombre. C'est une page unique en JavaScript générée par `web/build.mjs` dans `public/espace.html`.
- **API** (`/api/...`) : routes Next.js avec base PostgreSQL (Drizzle ORM), comptes, sessions et règles de paiement.

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

`db:seed:demo` crée le compte administrateur et des données d'exemple. Les comptes d'exemple ont le mot de passe `Clipboost2026` : `yacine@clipboost.dz` (Clipper) et `agence@clipboost.dz` (Agence). Pour une vraie installation, utilisez `npm run db:seed`, qui crée seulement l'administrateur.

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

## Mettre en ligne

1. Créer une base PostgreSQL (Neon, Supabase ou un serveur PostgreSQL).
2. Appliquer le schéma et créer l'administrateur :
   ```bash
   DATABASE_URL=postgres://… npm run db:migrate
   DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed
   ```
3. Déployer (Vercel ou tout hébergeur Node.js) avec `DATABASE_URL`, `RESEND_API_KEY` et `EMAIL_FROM`, puis `npm run build` et `npm start`.

## Fichier HTML autonome

```bash
npm run build:offline        # next build, puis web/dist/clipboost-site.html
```

Produit un seul fichier HTML (accueil, connexion, espaces Clipper, Agence et Admin) qui s'ouvre directement depuis le disque, sans serveur ni connexion internet : pratique pour une démonstration. L'API y est simulée dans le navigateur (`web/offline/`) avec les mêmes règles (`lib/server/rules.ts`) et les mêmes contrôles (`lib/server/validation.ts`) que le serveur ; les données sont enregistrées dans le `localStorage` du navigateur.

Au premier lancement, le fichier contient les données d'exemple de `db:seed:demo` et le compte `admin@clipboost.dz` (mot de passe `AdminClip2026`). Les codes de vérification sont affichés à l'écran. « Réinitialiser la démo », dans les réglages de l'administration, efface les données du navigateur.

Si l'accueil a déjà été construit (`.next/`), `node web/build.mjs --offline [fichier]` suffit.

## Règles métier

Les réglages sont modifiables par l'administrateur (page « Réglages du site »). Valeurs par défaut :

- **Campagnes** : budget minimum 50 000 DA, commission de 15 % payée par l'agence en plus du budget. À l'approbation, le budget et la commission sont débités du crédit de l'agence ; à la fin de la campagne, le budget non dépensé est rendu avec sa commission.
- **Clips** : lien TikTok, Instagram ou YouTube obligatoire, unique. Gain = vues × tarif aux 1 000 vues, nul sous le seuil minimum et limité au plafond par clip. Après validation, le clip continue de rapporter pendant 7 jours.
- **Gains** : 3 jours de rétention avant d'être retirables.
- **Retraits** : minimum 2 000 DA vers BaridiMob, CCP ou RIB. Standard gratuit, ou instantané avec 2 % de frais (100 DA minimum).
- **Crédit agence** : demande de recharge avec une référence, confirmée par l'administrateur à réception du paiement.
- **Agences côté clipper** : la page Campagnes s'ouvre sur la liste des agences qui organisent les campagnes visibles (l'agence propriétaire, ou la marque pour une campagne créée par ClipBoost), puis chaque agence a sa page (`#/clipper/agence/<clé>`) avec sa présentation et ses projets de clipping. Le clipper ne reçoit que leur profil public (nom, pays, présentation, date d'inscription).

Le code des règles est dans `lib/server/rules.ts` et `lib/server/services/`.

## Tests

```bash
npm test                                   # règles de calcul
npm run dev                                # puis, dans un autre terminal :
BASE_URL=http://localhost:3000 npx tsx tests/api-flow.mts   # parcours API complet
```

Le parcours API crée une agence et un clipper, finance et approuve une campagne, valide un clip et vérifie les paiements, les rôles et la protection CSRF. Il lit le code de vérification renvoyé en développement : lancez-le contre `npm run dev`, pas contre `npm start`.

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

- Relevé automatique des vues par les API TikTok, Instagram et YouTube (aujourd'hui saisies par l'administrateur).
- Paiement en ligne des recharges par carte Edahabia ou CIB (aujourd'hui confirmées à la main).
- Liaison vérifiée des comptes sociaux des clippers.
- Pages légales (CGU, confidentialité) validées par un juriste.
