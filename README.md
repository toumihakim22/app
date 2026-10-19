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
| `yacine@clipboost.dz` | Clipper | Gains, retraits, un clip publié sur TikTok et Instagram en un seul envoi, comptes TikTok, Instagram et YouTube vérifiés |
| `amira@clipboost.dz`, `lina@clipboost.dz` | Clipper | Clips en attente, validés ou refusés ; Amira a aussi un compte TikTok en attente de vérification (code à coller dans sa bio) ; Lina conteste le refus de « Sketch du marché » (recours en cours, avec sa capture d'écran) |
| `admin@clipboost.dz` | Administration | Modération avec le score de risque de chaque clip : « Quand ta mère trouve ton bulletin » (Lina) a un pic de vues soudain et très peu de likes (risque élevé), l'Instagram du but de la 89e peu de likes (risque moyen) ; historique des vues sur 14 jours dans la fiche d'un clip, dernier relevé automatique il y a 2 heures ; onglet « Recours » avec le recours de Lina à accepter ou refuser |
| `agence@clipboost.dz` | Agence (Tassili Sport) | Campagnes actives et en pause, une campagne refusée avec son motif (à modifier et relancer, ou à supprimer), une recharge payée en ligne par carte Edahabia (Chargily) ; « Recharger le crédit » par Edahabia ou CIB ouvre la page de paiement simulée |
| `hoggar@clipboost.dz` | Agence (Hoggar Boissons) | Campagne en attente de vérification, recharge à confirmer, badge de vérification demandé |
| `djurdjura@clipboost.dz` | Agence (Djurdjura Médias) | Agence vérifiée (badge bleu), campagne active sur YouTube, Facebook et Instagram |

Pour une vraie installation, utilisez `npm run db:seed`, qui crée seulement l'administrateur.

Avec la base embarquée, lancez le seed **avant** `npm run dev` : PGlite n'accepte qu'un processus à la fois.

Sans clé `RESEND_API_KEY`, les codes de vérification sont affichés dans le terminal du serveur, et aussi à l'écran en développement.

En local, le relevé automatique des vues se lance à la main (`npm run cron:views`, serveur arrêté avec la base embarquée) ou avec le bouton « Relever les vues maintenant » de la modération ; voir « Relevé automatique des vues ».

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
| `YOUTUBE_API_KEY` | Vérification des comptes YouTube des clippers et relevé des vues de leurs clips : clé de l'API YouTube Data v3. |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID` | Vérification des comptes Instagram et relevé des vues : jeton d'accès de la Graph API de Meta et identifiant du compte Instagram professionnel de ClipBoost qui interroge la Business Discovery. |
| `FACEBOOK_ACCESS_TOKEN` | Vérification des pages Facebook et relevé des vues des vidéos : jeton d'accès de la Graph API de Meta. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Vérification des comptes TikTok et relevé des vues : clé et secret d'une application TikTok qui a accès à l'API Research. |
| `CHARGILY_SECRET_KEY` | Paiement en ligne des recharges par carte Edahabia ou CIB via [Chargily Pay](https://chargily.com) : clé secrète `test_sk_…` (mode test de Chargily) ou `live_sk_…`. Elle signe aussi les webhooks. Sans elle, le paiement en ligne est simulé en développement et refusé en production (voir « Paiement en ligne des recharges »). |
| `CRON_SECRET` | Secret de la tâche planifiée du relevé des vues : `GET /api/cron/views` exige l'en-tête `Authorization: Bearer <CRON_SECRET>` (Vercel Cron l'envoie de lui-même). **Obligatoire en production** pour ce relevé (sans lui, la route est refusée) ; facultatif en développement. |

Un bouton « Continuer avec … » n'apparaît que si les variables de son fournisseur sont toutes définies. Une plateforme sans toutes ses variables est vérifiée, et ses vues relevées, en **mode simulé** (voir ci-dessous).

## Connexion avec Google, Apple ou Discord

Le parcours (OAuth 2.0 / OpenID Connect, sans dépendance) est dans `lib/server/oauth.ts` : état à usage unique, PKCE (S256) pour Google et Discord, nonce pour Google et Apple, gardés dans un cookie `HttpOnly` de 10 minutes ; l'adresse email doit être vérifiée par le fournisseur. Le compte ClipBoost est retrouvé par le compte du fournisseur déjà relié, sinon par l'adresse email (il est alors relié), sinon créé à l'inscription avec le rôle choisi (Clipper ou Agence). Un compte créé ainsi n'a pas de mot de passe : il peut en définir un dans Paramètres, ou avec « Mot de passe oublié ». Les comptes administrateurs se connectent uniquement avec leur mot de passe ; la suspension, la maintenance et la fermeture des inscriptions s'appliquent comme pour la connexion par mot de passe. En cas d'échec, l'app reçoit `/espace?oauth_error=<code>` et affiche le message correspondant.

Adresses de retour (« redirect URI ») à déclarer chez chaque fournisseur, avec `APP_URL` = votre domaine :

| Fournisseur | Où la déclarer | Adresse de retour |
|---|---|---|
| Google | Google Cloud Console → API et services → Identifiants → ID client OAuth (application Web) | `https://<domaine>/api/auth/oauth/google/callback` |
| Discord | Discord Developer Portal → votre application → OAuth2 → Redirects | `https://<domaine>/api/auth/oauth/discord/callback` |
| Apple | Apple Developer → Identifiers → Services ID → Sign in with Apple → Configure (domaine et « Return URL ») | `https://<domaine>/api/auth/oauth/apple/callback` |

En local, Google et Discord acceptent `http://localhost:3000/api/auth/oauth/<fournisseur>/callback` ; Apple exige un domaine en HTTPS. Apple revient sur le site par un formulaire envoyé depuis `appleid.apple.com` : son cookie de parcours est `SameSite=None; Secure`. Le cookie de parcours est posé sur le domaine où l'utilisateur clique le bouton : servez le site sur le seul domaine de `APP_URL` (redirigez par exemple `www.` vers le domaine principal), sinon le retour du fournisseur ne le retrouve pas (« La connexion a expiré »).

## Vérification des comptes sociaux

Un clipper relie ses comptes dans Profil → Comptes sociaux : un compte par plateforme (TikTok, Instagram, YouTube, Facebook), saisi par son identifiant (`@compte`) ou l'adresse de son profil. ClipBoost lui donne un code `CB-XXXX` (4 signes sans ambiguïté : ni 0/O ni 1/I/L) ; il le colle dans la bio du compte, puis clique « Vérifier ». Le serveur lit la bio par l'API officielle de la plateforme (`lib/server/platforms.ts`) et y cherche le code, en majuscules ou en minuscules. Une fois le compte vérifié, le code peut être retiré de la bio.

| Plateforme | Appel | Ce qui est lu |
|---|---|---|
| YouTube | `GET googleapis.com/youtube/v3/channels?part=snippet&forHandle=@<compte>` | Description de la chaîne |
| Instagram | `GET graph.facebook.com/v21.0/<INSTAGRAM_BUSINESS_ID>?fields=business_discovery.username(<compte>){biography}` | Biographie (comptes professionnels seulement : créateur ou entreprise) |
| Facebook | `GET graph.facebook.com/v21.0/<page>?fields=about,description` | « À propos » et description d'une page |
| TikTok | jeton `POST open.tiktokapis.com/v2/oauth/token/` (client credentials), puis `POST …/v2/research/user/info/?fields=bio_description` | Bio du compte |

**Mode simulé** : une plateforme dont les variables ne sont pas toutes définies n'est pas interrogée et **la vérification réussit toujours** (le serveur le signale une fois par plateforme dans ses journaux en production, et l'app l'indique au clipper). C'est une facilité pour le développement et la démonstration (la version autonome est toujours en mode simulé) : en production, définissez les variables de chaque plateforme, sinon n'importe quel compte peut être déclaré vérifié. Limites des API : la Business Discovery ne voit que les comptes Instagram professionnels ; la lecture d'une page Facebook demande l'accès « Page Public Metadata Access » (examen de l'application par Meta) ; l'API Research de TikTok est réservée aux organismes agréés par TikTok. Une API en panne ou qui refuse la requête laisse le compte en attente avec un message clair (« Vérification TikTok indisponible pour le moment… ») ; le détail va dans les journaux du serveur.

Ces clients (jeton TikTok, Graph API de Meta, requête avec délai maximal) servent aussi au relevé automatique des vues.

## Relevé automatique des vues et score de risque

Toutes les 6 heures, le serveur relève les vues (et les likes) de chaque clip suivi : en attente, ou validé depuis moins de 7 jours (il rapporte encore), dont la campagne est active ou en pause. Chaque relevé (`recordViews`, `lib/server/services/clips.ts`) remplace celui du jour dans l'historique jour par jour (table `view_snapshots`, un relevé par clip et par jour UTC), recalcule le score de risque du clip et paie les vues supplémentaires d'un clip validé, comme une saisie de l'équipe. Les vues ne baissent jamais : un nombre inférieur lu sur une plateforme garde le dernier relevé. La dernière exécution et son bilan (clips suivis, mis à jour, simulés, en erreur) sont gardés dans la table `job_runs` (tâche `views`) et affichés dans la modération.

Trois façons de le lancer (même relevé, `lib/server/services/tracking.ts`) :

- **Vercel Cron** : `vercel.json` appelle `GET /api/cron/views` à `0 */6 * * *`, avec `CRON_SECRET`. L'offre gratuite Hobby de Vercel limite les tâches planifiées à une par jour : passez à l'offre Pro, ou appelez la route depuis un autre planificateur (crontab, GitHub Actions…) avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
- **Crontab** d'un serveur Node.js : `0 */6 * * * cd /chemin/vers/clipboost && npm run cron:views` (`scripts/track-views.mts`, avec les mêmes variables d'environnement que le site ; avec la base embarquée PGlite, serveur arrêté).
- **Bouton « Relever les vues maintenant »** de la modération (`POST /api/admin/track-views`, 5 fois par quart d'heure au plus).

| Plateforme | Appel (`fetchClipStats`, `lib/server/platforms.ts`) | Limites |
|---|---|---|
| YouTube | `GET googleapis.com/youtube/v3/videos?part=statistics&id=<vidéo>` (lien `/shorts/<id>`, `watch?v=<id>`, `youtu.be/<id>`) | Likes absents si la chaîne les masque |
| TikTok | `POST open.tiktokapis.com/v2/research/video/query/?fields=id,view_count,like_count`, vidéo cherchée par son identifiant (lien `/@compte/video/<id>`) parmi celles créées dans les 30 jours avant l'envoi | API Research réservée aux organismes agréés ; liens courts `vm.tiktok.com` non lus (pas d'identifiant) |
| Instagram | Business Discovery du compte vérifié du clipper : `…?fields=business_discovery.username(<compte>){media.limit(50){permalink,like_count,view_count}}`, publication retrouvée par son code (`/reel/<code>`) | Comptes professionnels seulement, 50 dernières publications ; `view_count` n'est pas toujours fourni (clip alors compté en erreur) |
| Facebook | `GET graph.facebook.com/v21.0/<vidéo>?fields=views,likes.summary(true)` (lien `/videos/<id>`, `/reel/<id>`, `watch?v=<id>`) | Vidéos publiques de pages ; accès accordé par Meta après examen de l'application |

**Mode simulé** : une plateforme sans toutes ses clés n'est pas interrogée ; ses vues suivent une croissance plausible et déterministe tirée de l'identifiant et de l'âge du clip (rapide au début puis de plus en plus lente, likes de 3 à 8 % des vues ; `simulatedStats`, `lib/server/rules.ts`). La modération indique les plateformes simulées. Avec des clés, une API en panne ou une vidéo introuvable fait passer le clip pour ce tour : rien n'est inventé, le clip est compté en erreur et le détail va dans les journaux du serveur. La version autonome est toujours en mode simulé et lance le relevé à l'ouverture de l'app quand le dernier a plus de 6 heures.

**Score de risque de fraude** (0 à 100, `fraudRisk`, `lib/server/rules.ts`), recalculé à chaque relevé et dès l'envoi du clip, montré seulement à l'équipe (pastille dans les listes de clips, tri par risque dans la modération, détail et historique des 14 derniers jours dans la fiche d'un clip) :

| Signal | Condition | Poids |
|---|---|---|
| Pic de vues soudain | Entre deux relevés des 14 derniers jours, plus de 5 000 vues par jour et plus de 5 fois le rythme moyen des relevés précédents (rythme calculé sur l'heure réelle des relevés : un jour de publication à peine entamé ne compte pas pour un jour entier), ou plus de 50 000 vues par jour au premier relevé, fait moins de 48 heures après la publication | 45 |
| Beaucoup de vues, peu de likes | Au moins 5 000 vues et moins de 0,5 % de likes (likes connus seulement) | 35 |
| Compte récent | Compte ClipBoost du clipper, ou son compte vérifié sur la plateforme du clip, de moins de 7 jours à l'envoi du clip | 20 |

Niveaux : faible sous 30, moyen de 30 à 59, élevé à partir de 60. Le score aide l'équipe à choisir quoi vérifier : il ne refuse ni ne bloque rien.

## Paiement en ligne des recharges (Edahabia, CIB)

Une agence recharge son crédit par carte Edahabia ou CIB en ligne, via Chargily Pay (`lib/server/chargily.ts`, API v2 sans SDK ; parcours dans `lib/server/services/payments.ts`) :

1. « Recharger le crédit » → « Payer en ligne » : `POST /api/credit/checkout` crée la recharge « En cours » (colonnes `provider` = `chargily` et `provider_ref` = identifiant du paiement chez Chargily), puis `POST /checkouts` chez Chargily (montant en DA, `payment_method` `edahabia` ou `cib`, langue du compte, transaction dans `metadata`). L'agence est envoyée sur la page de paiement de Chargily.
2. Après le paiement (réussi ou non), Chargily ramène l'agence sur `<APP_URL>/espace#/agence/budget/<recharge>` : la recharge y est mise en évidence et son état relu toutes les 3 secondes pendant une minute.
3. Chargily appelle le webhook `POST <APP_URL>/api/payments/chargily/webhook`. L'en-tête `signature` (HMAC-SHA256 hexadécimal du corps brut avec `CHARGILY_SECRET_KEY`, comparé à temps constant) est vérifié, sinon 401. `checkout.paid` valide la recharge et ajoute le montant au crédit de l'agence (`settleOnlinePayment`, avec la même validation qu'une confirmation par l'équipe : `validateRecharge`, `services/wallet.ts`) ; l'agence et les admins sont prévenus. `checkout.failed`, `checkout.canceled` et `checkout.expired` la refusent (« Paiement en ligne annulé ou refusé »). Un webhook reçu deux fois ne crédite qu'une fois (200 sans effet) ; un montant différent de la recharge est refusé (400, détail dans les journaux).
4. Une recharge restée en cours (page de paiement quittée, webhook perdu) a un bouton « Reprendre le paiement » dans Budget (`POST /api/credit/checkout/<id>`) : l'état est relu chez Chargily (`GET /checkouts/<id>`) ; payé, annulé ou expiré, la recharge est réglée aussitôt, sinon l'agence retourne sur la page de paiement.

À déclarer dans le tableau de bord de Chargily Pay (Developers Corner) : l'adresse du webhook `https://<domaine>/api/payments/chargily/webhook`, en mode test comme en mode réel (`APP_URL` doit être l'adresse publique : elle sert aux adresses de retour et à celle du webhook ; en local, Chargily ne peut pas joindre `localhost`, passez par un tunnel HTTPS). Avec une clé `test_sk_…`, l'API de test de Chargily est utilisée (`https://pay.chargily.net/test/api/v2`) : aucune carte n'est débitée. Le crédit ajouté est toujours le montant de la recharge.

**Mode simulé** (sans `CHARGILY_SECRET_KEY` en développement, et toujours dans la version autonome) : aucune requête vers Chargily ; « Payer en ligne » ouvre une page de paiement simulée dans l'app (`#/agence/paiement/<recharge>`, bien signalée « Mode simulé ») avec « Payer » et « Annuler » (`POST /api/payments/simulate/<id>`, permis seulement sans clé et seulement à l'agence de la recharge). Le webhook répond 503 sans clé. En production (`NODE_ENV=production`, dont `npm start`), le mode simulé permettrait à une agence de se créditer sans payer : sans clé, le paiement en ligne y est refusé (« Paiement en ligne non configuré ») ; virement et carte Visa / Mastercard restent possibles.

Les recharges payées en ligne apparaissent dans Paiements (onglet Recharges) avec la pastille « Chargily » ; l'équipe ne peut ni les confirmer ni les refuser à la main (« Paiement en ligne : confirmé automatiquement par Chargily »), ce qui évite de créditer deux fois le même paiement. Le virement bancaire et la carte Visa / Mastercard restent confirmés par l'équipe à réception du paiement ; `POST /api/credit` refuse désormais Edahabia et CIB (paiement en ligne).

## Mettre en ligne

1. Créer une base PostgreSQL (Neon, Supabase ou un serveur PostgreSQL).
2. Appliquer le schéma et créer l'administrateur :
   ```bash
   DATABASE_URL=postgres://… npm run db:migrate
   DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed
   ```
   À chaque mise à jour, relancez `npm run db:migrate` (migrations SQL de `drizzle/`, appliquées une seule fois). En développement avec la base embarquée, elles s'appliquent au démarrage.
3. Déployer (Vercel ou tout hébergeur Node.js) avec `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`, `CHARGILY_SECRET_KEY` (et l'adresse du webhook déclarée chez Chargily), les clés des API des plateformes (vérification des comptes sociaux, relevé des vues) et, si besoin, les identifiants Google, Apple et Discord, puis `npm run build` et `npm start`.
4. Planifier le relevé des vues toutes les 6 heures : sur Vercel, `vercel.json` s'en charge ; ailleurs, une crontab (voir « Relevé automatique des vues et score de risque »).

## Images

Photos de profil (tous les comptes), photos de couverture (agences) et photos de campagne sont recadrées et compressées dans le navigateur ; les captures d'écran jointes à un recours sont seulement réduites (1 600 px au plus de côté), jamais recadrées. Toutes sont ensuite envoyées en data URL (JPEG, PNG ou WebP, 1,5 Mo au plus). Le serveur vérifie leur contenu (signature du format), les range dans la table `media` de PostgreSQL et les sert à l'adresse `/api/media/<id>`, publique et mise en cache indéfiniment (une image remplacée prend une nouvelle adresse ; l'ancienne est supprimée). Pour un très gros volume, ce stockage pourra passer sur un stockage objet (S3, R2…) sans changer les adresses enregistrées.

## Fichier HTML autonome

```bash
npm run build:offline        # next build, puis web/dist/clipboost-site.html
```

Produit un seul fichier HTML (accueil, connexion, espaces Clipper, Agence et Admin) qui s'ouvre directement depuis le disque, sans serveur ni connexion internet : pratique pour une démonstration. L'API y est simulée dans le navigateur (`web/offline/`) avec les mêmes règles (`lib/server/rules.ts`) et les mêmes contrôles (`lib/server/validation.ts`) que le serveur ; les données sont enregistrées dans le `localStorage` du navigateur.

Au premier lancement, le fichier contient les données d'exemple de `db:seed:demo` et le compte `admin@clipboost.dz` (mot de passe `AdminClip2026`). Les codes de vérification sont affichés à l'écran. Les connexions Google, Apple et Discord y sont simulées (fenêtre de consentement fictive, aucun échange avec le fournisseur), avec les mêmes règles que sur le serveur ; les images sont gardées dans la base du navigateur, et une requête qui dépasserait la place disponible est refusée sans rien perdre des données déjà enregistrées. Le relevé des vues y est simulé et lancé à l'ouverture de l'app quand le dernier a plus de 6 heures (ou avec le bouton de la modération). Le paiement en ligne des recharges (Edahabia, CIB) y passe toujours par la page de paiement simulée. « Réinitialiser la démo », dans les réglages de l'administration, efface les données du navigateur.

Si l'accueil a déjà été construit (`.next/`), `node web/build.mjs --offline [fichier]` suffit.

## Règles métier

Les réglages sont modifiables par l'administrateur (page « Réglages du site »). Valeurs par défaut :

- **Campagnes** : budget minimum 50 000 DA, commission de 15 % payée par l'agence en plus du budget. À l'approbation, le budget et la commission sont débités du crédit de l'agence ; à la fin de la campagne, le budget non dépensé est rendu avec sa commission.
- **Vérification des campagnes** : une agence peut modifier ou annuler sa campagne tant que l'équipe ne l'a pas examinée. Une campagne refusée l'est avec un motif ; l'agence peut la modifier et la relancer (elle repasse en vérification) ou la supprimer. Une campagne en ligne ne se refuse plus : elle se termine, ce qui rend son budget.
- **Catégories** : 17 catégories proposées, ou « Autre » avec la catégorie précisée par l'agence.
- **Comptes sociaux** : un compte par plateforme et par clipper, vérifié par le code `CB-XXXX` collé dans sa bio (voir « Vérification des comptes sociaux »). Un compte en attente peut changer d'identifiant (il garde son code) ; un compte vérifié doit être retiré avant d'en relier un autre sur la même plateforme. Un même compte n'est vérifié que par un seul clipper (« Ce compte est déjà vérifié par un autre clipper »). Les `@compte` du profil montrés aux agences et à l'équipe suivent les comptes vérifiés ; l'administrateur voit les comptes de chaque clipper, vérifiés ou en attente, sur sa fiche. Vérifications limitées à 10 par quart d'heure et par clipper, ajouts à 30 par heure.
- **Clips** : lien TikTok, Instagram, YouTube ou Facebook obligatoire, unique, publié depuis le compte vérifié du clipper sur cette plateforme (sinon « Vérifiez d'abord votre compte … ») ; quand le lien nomme son compte (TikTok `tiktok.com/@compte/video/…`, YouTube `youtube.com/@compte/…`), ce doit être le compte vérifié. Le clipper publie sur toutes les plateformes de la campagne ou sur une seule : un lien par plateforme, enregistrés ensemble (même lot) et examinés séparément. Gain = vues × tarif aux 1 000 vues, nul sous le seuil minimum et limité au plafond par clip. Après validation, le clip continue de rapporter pendant 7 jours, tant que la campagne est active ou en pause : une campagne terminée ne paie plus rien (son budget restant a été rendu à l'agence) et ses clips en attente ne peuvent plus qu'être refusés.
- **Recours** : le clipper peut contester une seule fois le refus d'un clip (« Contester le refus » dans ses publications), avec un message de 20 à 1 000 caractères et une capture d'écran en preuve (obligatoire, envoyée entière, sans recadrage). Les admins sont prévenus ; l'équipe accepte ou refuse le recours depuis l'onglet « Recours » de la modération, avec un motif obligatoire (3 à 300 caractères) que le clipper reçoit dans sa notification. Accepter valide le clip comme une validation normale (même règle : campagne active ou en pause, seuil atteint, gain crédité) ; si c'est impossible, l'erreur s'affiche et le recours reste en attente. Un refus est définitif.
- **Relevé des vues** : automatique toutes les 6 heures pour les clips en attente et les clips validés depuis moins de 7 jours ; l'équipe peut aussi saisir les vues (et, facultativement, les likes) d'un clip, sans jamais les faire baisser. Historique jour par jour gardé pour chaque clip.
- **Score de risque de fraude** : pic de vues soudain (45), beaucoup de vues pour peu de likes (35), compte récent (20), plafonné à 100 ; faible sous 30, moyen jusqu'à 59, élevé au-delà. Réservé à l'équipe (voir « Relevé automatique des vues et score de risque »).
- **Gains** : 3 jours de rétention avant d'être retirables.
- **Retraits** : minimum 2 000 DA vers BaridiMob, CCP ou RIB. Standard gratuit, ou instantané avec 2 % de frais (100 DA minimum).
- **Crédit agence** : recharge de 10 000 DA minimum. Carte Edahabia ou CIB : paiement en ligne via Chargily Pay, crédit ajouté automatiquement dès la confirmation du paiement (webhook), recharge refusée si le paiement échoue, est annulé ou expire (voir « Paiement en ligne des recharges »). Virement bancaire ou carte Visa / Mastercard : demande avec une référence, confirmée par l'administrateur à réception du paiement ; pour une carte, seuls la marque et les 4 derniers chiffres sont transmis et ajoutés au libellé.
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
| `POST /api/social` | clipper | Compte social : `{ platform, handle }` (identifiant ou adresse du profil) → `{ id, code }` ; remplace l'identifiant d'un compte en attente de la même plateforme (même code) |
| `POST /api/social/<id>/verify` | clipper | Vérifie le code dans la bio du compte → `{ simulated }` (`true` : plateforme en mode simulé) |
| `DELETE /api/social/<id>` | clipper | Retire un compte (en attente ou vérifié) |
| `POST /api/clips` | clipper | Clip : `{ campaignId, title, links: [{ platform, url }] }`, depuis les comptes vérifiés du clipper |
| `POST /api/clips/<id>/views`, `…/review` | admin | Vues relevées `{ views, likes? }` (likes facultatifs, gardés s'ils sont absents) ; validation ou refus |
| `POST /api/clips/<id>/appeal` | clipper | Recours contre le refus d'un clip : `{ message, proof }` (20 à 1 000 caractères, capture d'écran en data URL) → `{ id }` ; un seul par clip |
| `POST /api/appeals/<id>/review` | admin | Décision sur un recours : `{ approve, reason }` (motif obligatoire) ; accepté, le clip est validé et payé |
| `POST /api/admin/track-views` | admin | Relève tout de suite les vues des clips suivis → bilan `{ by, total, updated, simulated, failed, at }` |
| `GET /api/cron/views` | tâche planifiée | Relevé des vues toutes les 6 heures (Vercel Cron), avec `Authorization: Bearer <CRON_SECRET>` → même bilan |
| `POST /api/credit`, `/api/withdrawals` | agence, clipper | Recharge annoncée (virement bancaire ou carte Visa / Mastercard, confirmée par l'équipe) ; demande de retrait |
| `POST /api/credit/checkout` | agence | Paiement en ligne d'une recharge : `{ amount, method: "carte Edahabia" \| "carte CIB" }` → `{ id, ref, checkoutUrl, simulated }` (page de Chargily Pay, ou page simulée `#/agence/paiement/<id>`) ; 10 par quart d'heure |
| `POST /api/credit/checkout/<id>` | agence | « Reprendre le paiement » : état relu chez Chargily → `{ status, checkoutUrl }` (réglée : `checkoutUrl` null) |
| `POST /api/payments/chargily/webhook` | Chargily Pay | Webhook signé (en-tête `signature`) : `checkout.paid` crédite l'agence, `checkout.failed` / `canceled` / `expired` refusent la recharge ; idempotent |
| `POST /api/payments/simulate/<id>` | agence | Mode simulé seulement (sans clé Chargily) : `{ paid }`, issue du paiement choisie sur la page simulée |
| `POST /api/verification` | agence | Demande du badge de vérification |
| `POST /api/admin/users/<id>/verification` | admin | Badge : `{ decision: "approve" \| "reject" \| "revoke", reason? }` |
| `PATCH /api/admin/users/<id>`, `/api/admin/settings` ; `POST /api/transactions/<id>/review` | admin | Suspension, réglages, retraits et recharges annoncées (pas les recharges payées en ligne) |

## Tests

```bash
npm test                                   # règles de calcul et score de risque, API simulée hors ligne (relevé des vues, recours et paiement en ligne compris), lecture des bios et des statistiques (API des plateformes simulées), paiement Chargily (signature et webhook sur une base PGlite temporaire, API de Chargily simulée)
npm run dev                                # puis, dans un autre terminal :
BASE_URL=http://localhost:3000 npx tsx tests/api-flow.mts   # parcours API complet
```

Le parcours API crée une agence et un clipper, envoie des images, finance et approuve une campagne, en modifie, refuse, relance et supprime une autre, traite une demande de badge, vérifie les comptes TikTok et Instagram du clipper (mode simulé : lancez-le sans les clés des API), valide un clip publié sur deux plateformes et vérifie les paiements (dont le paiement en ligne simulé : lancez-le sans `CHARGILY_SECRET_KEY`), les rôles et la protection CSRF. Il lit le code de vérification renvoyé en développement : lancez-le contre `npm run dev`, pas contre `npm start`.

## Structure

```
app/                 accueil (React) et routes API
components/landing/  sections de la page d'accueil
lib/server/          base de données, authentification, règles et services
drizzle/             migrations SQL
scripts/             migrate, seed et relevé des vues (cron:views)
web/                 application /espace (JavaScript, sans framework) et version autonome (web/offline/)
tests/               tests des règles et du parcours API
```

## Reste à faire avant un lancement public

- Paiement en ligne des recharges par carte Visa ou Mastercard (Edahabia et CIB passent par Chargily Pay ; Visa / Mastercard sont encore confirmées à la main par l'équipe).
- Vérification de fond des agences avant le badge (documents, registre du commerce).
- Pages « Mentions légales » et « Aide et support » du menu du compte.
- Accès de production aux API des plateformes pour la vérification des comptes sociaux et le relevé des vues (examen de l'application par Meta, accès à l'API Research de TikTok ou, à défaut, connexion du clipper avec TikTok Login Kit).
- Relevé des vues des liens courts (`vm.tiktok.com`, `fb.watch`) : suivre la redirection pour trouver l'identifiant de la vidéo (ces clips sont aujourd'hui comptés en erreur quand la plateforme a ses clés).
- Pages légales (CGU, confidentialité) validées par un juriste.
