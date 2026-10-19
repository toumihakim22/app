# ClipBoost : design system final

> **Base retenue :** la direction « Fintech-grade clarity » (lisibilité de l'argent, une seule source de tokens, graphiques honnêtes).
> **Greffes :** la police d'affichage, les états lus dans l'ARIA, les avatars accessibles, les pictogrammes d'événements et la coquille mobile de « Systèmes et accessibilité » ; les moments de motivation, la pédagogie du seuil et du plafond et les raccourcis d'argent de « Creator-economy energy ».
> **On garde l'identité DROPP :** cartes blanches arrondies (20 px), accent violet `#7c3aed`, courbe de revenus verte `#0f766e`, symbole « play » violet, mot-symbole incliné.
> **Vérifié avant d'écrire, avec le Tailwind 4.3.3 du dépôt :**
> - `app/theme.css` et `app/dark.css` (§3) compilent ;
> - chaque classe des références `ui.js` et `main.js` (§4) est bien générée (461 classes contrôlées, aucune manquante) ;
> - les helpers de format ont été exécutés sous Node (`−1 234 567 DA`, `48,2 k`, `< 1 %`, `150 DA / 1 000 vues`) ;
> - les 4 woff2 sont inlinés : le CSS de `/espace` passe de 51 Ko à 178 Ko ;
> - tous les contrastes ont été calculés (WCAG 2.x) en clair et en sombre ;
> - la palette des graphiques est validée par le script `validate_palette.js` (simulation de daltonisme, OKLab) ;
> - `@source not` a été testé : il exclut bien `web/` et `docs/` du CSS du landing.

---

## 0. Plan d'implémentation

### 0.1 Répartition des fichiers (un propriétaire par fichier, aucun autre fichier modifié)

| Lot | Propriétaire de | Contenu |
|---|---|---|
| **A, socle** | `app/theme.css` (nouveau), `app/globals.css`, `app/dark.css`, `web/styles.css`, `web/build.mjs`, `web/src/ui.js`, `web/src/main.js`, `web/index.html`, `app/layout.tsx`, `package.json`, `package-lock.json` | Tokens, polices, bascule sombre réduite aux variables, helpers et recettes (§4), coquille (§6.1). |
| **B, clipper** | `web/src/clipper.js` | Accueil (aperçu et statistiques réunis), Découvrir, Agences, Publications, Portefeuille, Profil, Paramètres, modales (§6.2). |
| **C, agence** | `web/src/agency.js` | Aperçu, Campagnes, Clips, Budget, Profil, formulaire de campagne, modales (§6.3). |
| **D, admin** | `web/src/admin.js` | Vue d'ensemble, Utilisateurs, Campagnes, Modération, Paiements, Réglages, modales (§6.4). |
| **E, auth** | `web/src/auth.js` | Connexion, inscription, vérification, mot de passe (§6.5). |
| **F, landing 1** | `components/landing/` : `Header`, `Logo`, `Hero`, `IncomeCard`, `StatsStrip`, `HowItWorks`, `Campaigns`, `CampaignCard`, `SectionTitle`, `ThemeToggle` | §7.1 à §7.5. |
| **G, landing 2** | `components/landing/` : `Earnings`, `TransactionRow`, `Audiences`, `Testimonials`, `Faq`, `FinalCta`, `Footer` ; `app/page.tsx` ; `data/landing.ts` | §7.6 à §7.11. |

Fichiers que **personne** ne modifie : `web/theme.js`, `web/src/data.js`, `web/offline/*`, `lib/**`, `app/theme-init.ts`, `tests/**`, `public/**` (hors `public/espace.html`, généré).

Les lots B à G peuvent travailler **en parallèle de A** : tous les noms, signatures et chaînes de classes dont ils dépendent sont figés dans ce document (§4). Ils n'ont pas besoin d'attendre A pour écrire, seulement pour compiler.

### 0.2 Contrats entre fichiers (signatures inchangées)

Tous les fichiers `web/src/*.js` sont concaténés **dans une seule fonction** par `web/build.mjs` (ordre : `i18n`, les dictionnaires `i18n/<langue>/*.js`, `data`, `ui`, `auth`, `clipper`, `admin`, `agency`, `main`). Conséquence : **déclarer au niveau supérieur un nom déjà déclaré ailleurs provoque une SyntaxError** et casse toute l'application.

| Nom | Défini par | Utilisé par | Règle |
|---|---|---|---|
| `publicationsTable(list, { showUser, actions, amountLabel = "Gains" })` | B | C, D | B ajoute l'option `amountLabel` (C passe `"Coût"`). B rend aussi la colonne Décision de modération (`actions: true`) selon §6.4. |
| `me()`, `myTx()`, `myNotifs()`, `balance(u)`, `totalEarned(u)`, `maskAccount(a)` | B | A, C, D, E | `maskAccount` reste dans `clipper.js` ; B le corrige : chiffres seuls, `••••${NB}7890`. |
| `campaignForm(formName, submitLabel, note, c = null)`, `campaignPayload(data)` | C | D | `c` : campagne à modifier ou à relancer (champs préremplis) ; rendu selon §6.3. |
| `adminBadge(id)` | D | A | Inchangé. |
| `logout()`, `resetAuth()` | E | A | Inchangés. |
| `accountCard(u)`, `handlePasswordSubmit(data)` | A (`ui.js`) | B, C, D | Rendu selon §4.8 (email vérifié, connexions Google / Apple / Discord, mot de passe à changer ou à définir). |
| `captureDraft(form)`, `restoreDraft()`, `openStacked(modal)`, `closeStacked()`, `[data-rerender]` | A (`main.js`) | B, C, D | Brouillons et empilement des modales, §4.8. |
| `imageField(…)`, `setImageField(el, v)`, `nameWithBadge(u, cls)`, `verifiedBadge(cls, label)`, `themeModeSwitch(…)`, `langSwitch(…)` | A (`ui.js`) | B, C, D, E | §4.8. |
| `IncomeCard` : props `{ amount?: string; trend?: string }` | F | F (Hero) | Earnings (G) **ne l'utilise plus**. |
| `TransactionRow` : props `{ t: Transaction }` | G | F (Hero), G | Inchangées. |
| `SectionTitle` : props `{ eyebrow, title, text }` | F | G | Inchangées. |
| `Logo` : props `{ className?: string }` | F | G (Footer) | Inchangées. |
| `formatDA(value, { signed }?)` | G (`data/landing.ts`) | F, G | Même appel `formatDA(n)` ; passe à `U+00A0` et `U+2212` (§7). |
| Champ `gradient` de `data/landing.ts` | G | — | **Conservé** dans cette passe, mais plus lu : F utilise `className="cover" data-cat={c.category}`. |

**Noms réservés à `ui.js`** (personne d'autre ne les déclare) :
`NB`, `MINUS`, `fmt`, `da`, `daSigned`, `money`, `BIG`, `bigMoney`, `compact`, `pct`, `plural`, `rate`, `rateShort`, `code`, `groupAccount`, `icons`, `icon`, `EVENT_ICON`, `eventIcon`, `flagDz`, `logo`, `cx`, `FOCUS`, `BTN`, `btn`, `ICON_BTN`, `iconBtn`, `inputCls`, `inputLg`, `textareaCls`, `selectCls`, `CHEVRON`, `select`, `countrySelect`, `unitInput`, `searchInput`, `field`, `OPTIONAL`, `CHOICE`, `CHOICE_DANGER`, `SEG_CHOICE`, `RADIO`, `CHECKBOX`, `switchBtn`, `CARD`, `CARD_HOVER`, `TILE`, `card`, `cardHeader`, `kpiValue`, `DELTA`, `kpi`, `BADGE`, `TONE`, `DOT`, `STATUS_TONE`, `badge`, `statusBadge`, `PLATFORM_ICON`, `platformTag`, `roleBadge`, `COUNT`, `countBadge`, `opt`, `segmented`, `pills`, `chips`, `TABLIST`, `TAB`, `pageHeader`, `sectionHeader`, `emptyState`, `progress`, `coverAttr`, `THUMB`, `coverThumb`, `AVATARS`, `AVATAR_SIZE`, `avatar`, `TBL`, `TOAST`, `toast`, `MODAL_W`, `modalShell`, `summary`, `ALERT_ICON`, `alertBox`, `accountCard`, `siteBanner`, `themeToggle`, `LIVE`, `niceMax`, `seriesDates`, `dayLabel`, `barChart`, `cumulativeChart`, `barList`, `areaChart`, plus ceux déjà présents (`esc`, `MONTHS`, `date`, `ago`, `initials`, `campaignById`, `userById`, `rawEarnings`, `belowMin`, `isCapped`, `payoutOf`, `earningsOf`, `viewsFor`, `isEmail`, `copy`, `handlePasswordSubmit`, `homeOf`).
**Réservés à `main.js` :** `NAV_ITEM`, `NAV_ICON`, `MINI_HIDDEN`, `focusReturn`, `placeOverlayFocus`, `focusTrap`, `runLive`, `applyRouteItem`, `flashRow`, `NOTIF_DEST`, `notifDest`, `ITEM_PAGES`, `navView`, `ROUTE_ALIASES`, `accountMenu`, `MENU_ROW`, `MENU_ITEM`, `MENU_ICON`, `POPOVERS`, `topDialog`, `actionKey`, `fieldKey`, `visibleAll`, `FIRST_FIELD`, `focusModal`, `draftOwner`, `restoringDraft`, `draftControls`, `modalForms`, `modalFormOf`, `modalHasDraft`, `captureDraft`, `restoreDraft`, `openStacked`, `closeStacked`, `dismissModal`, `pointerDownTarget`, `shellAction`, `areaInput`, `pageTitle`, `fillForm`, `pageDrafts`, `pageDraftRoute`, `pageFormOf`, `capturePageDraft`, `dropPageDraft`, `restorePageDrafts`, `captureAny`.
**Ajoutés à `ui.js` (réservés) :** `FOCUS_INSET`, `coverArt`, `verifiedBadge`, `nameWithBadge`, `THEME_MODES`, `themeModeSwitch`, `langSwitch`, `IMAGE_SHAPES`, `IMAGE_MAX_CHARS`, `imageField`, `readImage`, `setImageField`, `PROVIDER_NAMES`, `listAnd`.
**Réservés à `clipper.js` (agences) :** `clNorm`, `clOrgKey`, `clOrgHref`, `clAgencyOf`, `clOrgName`, `clOrgType`, `clOrgAbout`, `clOrgMark`, `clOrgLink`, `clOrganisers`, `clCampHeader`, `clAgencyCard`, `clAgencies`, `cAgence`.
**Récapitulatifs en direct :** un fichier de zone **n'ajoute qu'une propriété** à l'objet partagé (`LIVE.withdraw = …`, `LIVE.budget = …`, `LIVE.campaign = …`), il ne redéclare jamais `LIVE`.
**Attention aux collisions connues :** `roleTag` existe déjà dans `admin.js` (d'où `roleBadge` dans `ui.js`) ; `campaignCard`, `campaignRow`, `incomeCard`, `txRow` existent dans `clipper.js`. Un fichier de zone qui a besoin d'un helper local le préfixe (`cl…`, `ag…`, `adm…`, `auth…`).

### 0.3 Compatibilité avec le site hors ligne (`web/offline/landing.js`, intouchable)

Ce script bascule des classes sur le landing statique. Il ne faut pas qu'elles prennent effet :
- **Onglets de catégorie** : il ajoute `bg-ink text-white` à l'onglet choisi et `bg-white text-gray-600 ring-1 ring-gray-200 hover:text-ink` aux autres, et lit `textContent`, `role="tab"`, `aria-selected`, `article[data-category]`, `data-search`.
  - Le landing **n'écrit jamais** `bg-white`, `text-white`, `bg-ink`, `text-gray-600`, `ring-gray-200` ni `hover:text-ink`.
  - `app/globals.css` exclut `web/` et `docs/` du scan (`@source not`). Ces classes ne sont donc **pas générées** et l'ajout du script reste sans effet.
  - L'apparence de la puce vient de `aria-selected:` (que le script met à jour).
  - F garde `role="tab"`, `aria-selected`, le libellé seul dans le bouton (pas de compteur dans `textContent`), `data-category` et `data-search` sur chaque `article`.
- **Bouton « Copier le lien »** : le script remplace la chaîne `"bg-brand-50 text-brand-700 hover:bg-brand-100"` et réécrit le texte en « Lien copié ✓ ». F n'utilise pas cette chaîne (le remplacement ne fait donc rien) et garde `button[data-copy]`.
- **Le message vide** créé par le script (`rounded-3xl bg-white …`) s'affiche sans style dans la version hors ligne. C'est accepté : ce fichier n'a pas de propriétaire.
- Le blanc **fixe** du landing (bouton blanc sur la carte violette) s'écrit `bg-on-brand`, jamais `bg-white`.

### 0.4 Règle des extras (Tailwind trie, l'ordre de la chaîne ne compte pas)

Tailwind v4 émet les utilitaires triés par propriété, puis par ordre alphabétique. Si deux classes posent la même propriété, **la dernière dans le CSS gagne, pas la dernière dans l'attribut**. Ce comportement a été vérifié : `relative` l'emporte sur `absolute`, `inline-grid` sur `hidden`, `px-3` sur `px-0`.
- L'argument `extra` de `btn()`, `iconBtn()`, `card()` et des recettes **ne doit jamais redéfinir une propriété déjà posée par la recette** (display, position, hauteur, padding, rayon, taille de texte).
- Pour masquer un bouton selon l'écran, **l'envelopper** : `<span class="lg:hidden">${btn(...)}</span>` ou `<span class="hidden sm:contents">…</span>`. Les variantes (`lg:hidden`, `hover:`, `aria-*:`) passent toujours après la base et fonctionnent en extra.
- `card(inner, cls)` : `cls` contient le padding (`"p-5"` par défaut, `"p-4 sm:p-5"`, `"p-0 overflow-hidden"`).

### 0.5 Vérifications avant de rendre un lot

```bash
npm run build:app                     # compile /espace (A, B, C, D, E)
node -e 'const h=require("fs").readFileSync("public/espace.html","utf8");const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).sort((a,b)=>b.length-a.length)[0];new Function(s);console.log("JS OK")'
npx next build                        # landing (A, F, G)
npm test                              # API : doit rester vert
# garde-fou : coller la commande du §3.11 ; 0 ligne attendue
```
Puis vérification visuelle de chaque écran du lot : clair, sombre, 390 px, et navigation au clavier.

**Définition de « terminé » :**
- le garde-fou ne renvoie rien ;
- plus aucun emoji d'interface (§8) ;
- chaque montant passe par `money()`, `bigMoney()`, `da()` ou `daSigned()` ;
- chaque statut passe par `statusBadge()` ou `badge()` ;
- chaque modale passe par `modalShell({ … })` (objet) ;
- en sombre, aucun bloc blanc ni texte illisible.

---

## 1. Arbitrage des trois directions

### 1.1 Notes (sur 10)

| Direction | Fidélité à la marque | Confiance (argent) | Finition | Faisabilité | Accessibilité et sombre | Verdict |
|---|---|---|---|---|---|---|
| **Fintech-grade clarity** | 8 | 9 | 8 | 9 | 9 | **Base.** Règles d'argent irréprochables, graphiques honnêtes, migration exhaustive, architecture compilée. Défauts : typographie trop neutre (Geist partout, wordmark en Geist), rayon de carte réduit à 16 px qui affadit DROPP, troisième fichier de police (Geist Mono). |
| **Systèmes et accessibilité** | 7 | 8 | 8 | 7 | 9 | **Greffes structurelles.** Excellente rigueur ARIA, police d'affichage pertinente, avatars AA, pictogrammes d'événements. Mais plus lourde : nouveau `app/components.css` de `@utility`, script de lint, polices dans `public/fonts` et des scripts sans propriétaire dans le plan. |
| **Creator-economy energy** | 7 | 6 | 7 | 7 | 8 | **Greffes de ton.** Bonnes idées de motivation et de pédagogie, mais carte de solde en dégradé violet, barre latérale admin en encre, étoiles, toasts festifs et deux polices de caractère (Bricolage Grotesque, Figtree) qui affaiblissent la crédibilité financière. |

### 1.2 Conflits tranchés

| Sujet | Options | Décision | Pourquoi |
|---|---|---|---|
| Polices | Geist + Geist Mono / Geist + Plus Jakarta Sans / Bricolage + Figtree | **Geist** (interface et tous les chiffres) + **Plus Jakarta Sans** (h1 à h3, `.font-display`, mot-symbole). Le code et les numéros de compte utilisent la pile monospace **système** (`font-mono`). | Deux familles maximum. Jakarta donne le caractère « créateur » aux titres sans toucher aux chiffres. Les monospaces système (SF Mono, Consolas, Menlo, Cascadia) ont un zéro barré ou pointé, ce qui suffit pour `T-0SZJ34` sans 38 Ko de plus. |
| Chiffres en Jakarta | autorisé / interdit | **Interdit.** Les montants, KPI et axes restent en Geist, même dans un titre. | Ils doivent avoir les mêmes chiffres tabulaires partout. |
| Rayon de carte | 16 / 20 / 24 px | **20 px** (`rounded-card`), modales 24 px (`rounded-panel`) | Garde la douceur DROPP. Les champs à 10 px et les tuiles à 12 px donnent la précision. |
| Badges | pilule / rectangle arrondi | `rounded-badge` (6 px) + bordure + point (ou icône) | Se distingue des puces de filtre (pilules). |
| Couleur de « Valider », « Approuver », « Virement effectué » | vert / violet | **Violet `primary`** | Un seul bouton d'action par zone. Le vert reste réservé à l'argent qui entre et aux statuts. Blanc sur `success-solid` ne fait que 3,74:1. |
| Toast | coloré / festif / inverse | **Inverse sombre** (`bg-inverse`) + icône teintée | Lisible sur toute page, dans les deux modes. |
| Barre latérale admin | encre / identique | **Coquille unique** sur `canvas` pour les 3 rôles, tag « Admin » | Moins de cas particuliers, et un mode sombre cohérent. |
| Mini-solde de barre latérale | supprimé / gardé | **Gardé, mais masqué** là où le même chiffre est le sujet de la page (Accueil et Portefeuille du clipper, Aperçu et Budget de l'agence) | Repère utile ailleurs, sans jamais doubler un chiffre sur un même écran. |
| Navigation mobile | hamburger + barre / barre seule | **Barre basse à 4 onglets + « Plus »** (qui ouvre le tiroir). Pas de hamburger dans la barre du haut. | Une seule entrée vers le tiroir. |
| Carte « Marque » du landing | violet / encre | `bg-brand-panel` (violet en clair, violet profond `#4c1d95` en sombre), CTA `bg-on-brand text-brand-700` | Corrige le bouton devenu noir en sombre. |
| Panneau de l'écran de connexion | faux solde / garanties | **Garanties réelles** tirées de `db.settings`, plus une courbe verte décorative **sans chiffres** | Pas de chiffres inventés sur l'écran où l'on tape son mot de passe. |
| Témoignages | étoiles / sans | **Sans étoiles**, mention « Témoignages illustratifs » | Honnêteté. |
| Drapeau | emoji / SVG | **SVG en ligne** (`flagDz()` dans l'app ; même SVG en JSX dans Hero et Footer) | Windows n'affiche pas les drapeaux emoji. |
| Halos et dégradés | partout / limités | **3 emplacements** : héros (color-mix 14 %), CTA final, panneau auth. Couvertures `.cover[data-cat]` à 2 arrêts. | Tout le reste est plat. |
| Couvertures de campagne | classes en base / CSS | **`.cover` + `data-cat`** (CSS du thème) | Les classes stockées en base ne sont jamais compilées dans `/espace`. |
| Tableaux | table partout / cartes | Vrai `<table>` à partir de `md`, liste en dessous (même conteneur) | Lisible à 390 px. |
| `dark:` dans les templates | libre / interdit | **Interdit**, sauf `dark:hidden` et `hidden dark:block` pour l'icône de thème | Les tokens basculent seuls. |
| Composants CSS partagés | `@utility` dans un nouveau fichier / chaînes JS | **Chaînes de classes** (`ui.js`), copiées à l'identique dans les `.tsx` | Aucun nouveau fichier ni propriétaire, Tailwind les scanne déjà. |

---

## 2. Diagnostic (fusionné, classé par impact)

1. **Les couvertures de campagne sont vides dans l'app.** Les dégradés sont stockés en base (`campaigns.gradient`) et jamais compilés par `web/styles.css`. Résultat : un emoji sur du blanc dans `/espace` (Campagnes, Accueil, Budget, Modération), alors que le landing affiche des dégradés saturés à 3 arrêts. On a deux produits qui ne se ressemblent pas.
2. **Le mode sombre est un remappage de classes** (`app/dark.css`, 75 règles) : toute classe oubliée échappe au thème.
   - Le bouton blanc « Lancer une campagne » de la carte violette devient une dalle noire.
   - `bg-ink` devient gris et le bouton « Soumettre un clip » a l'air désactivé.
3. **Contrastes insuffisants :**
   - badges « En attente » 3,07:1, « Validée » 3,58:1, « Refusée » 4,28:1 ;
   - métadonnées `gray-400` à 2,54:1 ;
   - rangs « #1 » et « 01 » à 1,24:1.
4. **Les graphiques mentent par la forme.**
   - Une série quotidienne de 2 ou 3 jours non nuls est lissée en cloches : elle suggère un revenu continu.
   - Pas d'axe, pas d'échelle, pas de date.
   - « Nouvelles inscriptions » (un comptage) est dessiné en aire lissée.
5. **Le même chiffre apparaît trois à quatre fois par écran** (Gains totaux, carte Revenus, total 30 jours, solde de la barre latérale). En finance, la redondance fait douter.
6. **Les montants ne sont pas professionnels :**
   - chiffres proportionnels alignés à gauche dans les tableaux ;
   - signes détachés (« − 2 000 DA ») ;
   - compacts incohérents (« 48 K », « 0 K ») ;
   - champs sans unité ni séparateur.
7. **Paiements admin :**
   - le numéro de compte à créditer est en 12 px gris, non groupé et non copiable ;
   - le net à virer n'est pas affiché ;
   - `0` et `O` se confondent dans les références.
8. **Les statuts n'ont pas de sens stable.**
   - « En attente » et « En pause » partagent l'ambre.
   - Les files normales (retraits en attente, compteurs de navigation) sont en rose-erreur.
   - Le budget consommé (une dépense) est en vert.
9. **L'action principale change de couleur** (encre ou violet selon l'écran) **et se dédouble** (en-tête et barre latérale sur le même écran).
10. **Arc-en-ciel décoratif :** tuiles KPI teintées, puces colorées, avatars criards, pastilles de plateforme aux couleurs de marque.
11. **Modération :**
    - la colonne Décision s'empile sur 3 lignes avec 3 styles de bouton ;
    - « Activité récente » reste vide, sans état vide.
12. **Faux signaux de confiance au portefeuille :**
    - cercles façon Mastercard pour un compte CCP ;
    - masquage « •••• é 89 » ;
    - trois conteneurs imbriqués ;
    - rétention en orange, qui se lit comme une dette.
13. **Typographie sans hiérarchie :**
    - pile système différente selon l'OS ;
    - `font-extrabold` partout ;
    - en-têtes de tableau en MAJUSCULES grises.
14. **Rayons « jouet » et cartes invisibles.** `rounded-3xl` est partout, même sur les tableaux et les champs. Les cartes blanches sur fond blanc ne tiennent qu'avec un `ring-gray-100`.
15. **Mobile :**
    - filtres empilés sur 4 lignes ;
    - la première campagne arrive à environ 500 px ;
    - KPI 2×2 qui prennent tout l'écran ;
    - zoom iOS sur les champs en 14 px ;
    - wordmark sans symbole.
16. **Auth :**
    - faux solde « 998 500 DA, +8,2 % » sur l'écran de mot de passe ;
    - drapeau emoji affiché comme un carré sous Windows ;
    - bouton principal noir sur une page, violet sur l'autre.
17. **Landing :**
    - « ? » orphelin dans le CTA final ;
    - « liste d'attente » qui contredit « 12 400+ clippers » ;
    - étoiles sur des témoignages fictifs ;
    - emoji dans la navigation ;
    - couvertures criardes.
18. **Agence, Budget :**
    - bouton « + Ajouter du budget » sur deux lignes ;
    - barre à 1 % invisible ;
    - chiffres de progression en 12 px gris.
19. **Admin, Réglages :** champs désalignés (libellés sur 2 lignes) et sans unité.
20. **La barre latérale s'arrête avant le bas de la page** et laisse une bande blanche en dessous. Correction : racine `bg-canvas`, barre `sticky top-0 h-dvh`.

---

## 3. Fondations et architecture des tokens

### 3.1 Polices (2 familles, auto-hébergées, aucune requête externe)

| Rôle | Paquet npm (version exacte) | Famille CSS | Fichiers inlinés | Poids |
|---|---|---|---|---|
| Interface, texte, **tous les chiffres** | `@fontsource-variable/geist@5.3.0` | `"Geist Variable"` | `geist-latin-wght-normal.woff2` (29,4 Ko) + `geist-latin-ext-wght-normal.woff2` (16,5 Ko) | axe `wght` 100 à 900 |
| Titres h1 à h3, `.font-display`, mot-symbole | `@fontsource-variable/plus-jakarta-sans@5.3.0` | `"Plus Jakarta Sans Variable"` | `plus-jakarta-sans-latin-wght-normal.woff2` (27,3 Ko) + `plus-jakarta-sans-latin-ext-wght-normal.woff2` (21,7 Ko) | axe `wght` 200 à 800 |

- **Total :** 95 Ko de woff2, environ 127 Ko en base64.
- **Contrôlé dans les fichiers :**
  - les deux polices ont `tnum` (chiffres tabulaires), `U+00A0` et `U+2212` (vrai signe moins) ;
  - aucune n'a `U+202F` (espace fine insécable) : **on utilise `U+00A0` partout**.
- **Graisses :**
  - 400 : texte ;
  - 500 : libellés, cellules, boutons ;
  - 600 : valeurs, titres de carte en Geist ;
  - 700 à 750 : titres en Jakarta ;
  - 800 : h1 du landing et mot-symbole.
  - `font-black` est interdit.
- **Pas de fichier italique.** L'oblique du mot-symbole vient de `-skew-x-6`.
- **Code et références** (`T-0SZJ34`, RIB, codes OTP) : `font-mono` (pile système de Tailwind), qui garantit un zéro distinct.

### 3.2 Échelle typographique

Les tokens `--text-*` portent la taille, la hauteur de ligne, la graisse et l'interlettrage. `text-section`, `text-heading`, `text-title*`, `text-h*` et `text-display` sont rendus en Plus Jakarta Sans quand ils sont sur un `h1` à `h3` (règle de base). **Sur une valeur chiffrée, utiliser `text-kpi` ou `text-money`** (Geist).

| Rôle | Classe | Taille / interligne | Graisse | Interlettrage |
|---|---|---|---|---|
| Héros du landing (h1) | `text-h1 sm:text-display` | 40/46 → 56/62 | 800 | −0,03 / −0,035em |
| Titre de section du landing (h2) | `text-h2 lg:text-h1` | 30/36 → 40/46 | 750 / 800 | −0,025em |
| Titre de page de l'app (h1) | `text-title-sm sm:text-title` | 22/28 → 26/32 | 750 | −0,02em |
| Titre de modale, de section de page (h2) | `text-heading` | 18/26 | 700 | −0,015em |
| Titre de carte (h2/h3) | `text-section` | 16/24 | 700 | −0,01em |
| Solde héros | `bigMoney(n, "money")` (`sm:text-money`) | 30/36 → 36/40 | 600 | −0,03em |
| Valeur KPI | `bigMoney(n)` ou `kpiValue()` (`text-xl sm:text-kpi`) | 20/28 → 26/32 | 600 | −0,02em |
| Texte d'interface (défaut de l'app) | `text-sm` | 14/20 | 400 | 0 |
| Texte courant du landing | `text-base leading-7`, chapô `text-lg leading-8` | 16/28, 18/32 | 400 | 0 |
| Libellé de champ, description, cellule secondaire | `text-small` | 13/18 | 500 ou 400 | 0 |
| Aide, méta, en-tête de tableau, badge | `text-xs` | 12/16 | 400 ou 500 | 0 |
| Axe de graphique, libellé de nav mobile, surtitre | `text-micro` | 11/14 | 500 | surtitre en majuscules : +0,08em |
| Champ de saisie | `text-base sm:text-sm` | 16 → 14 | 400 | 0 (16 px sous `sm` : pas de zoom iOS) |

En-têtes de tableau en casse de phrase (« Vues », « Montant »), jamais en MAJUSCULES.

### 3.3 Chiffres et argent (règles non négociables)

- **Format DA :**
  - entiers seulement ;
  - milliers séparés par `U+00A0`, et `U+00A0` avant « DA » : `14 308 DA` ;
  - jamais de décimales en dinars, jamais « DZD ».
- **Signe collé, vrai moins :** `+7 230 DA`, `−2 000 DA` (`U+2212`). Le signe n'apparaît que dans les historiques et les deltas, jamais sur un solde.
- **Direction, du point de vue de celui qui regarde :**
  - argent entrant : `+` et `text-income` ;
  - argent sortant : `−` et `text-fg` (un retrait n'est pas une erreur) ;
  - montant en attente : `text-fg` plus un badge de statut.
  - Une dépense d'agence n'est **jamais** verte.
- **Tableaux :** colonne numérique alignée à droite, `tabular-nums`, « DA » dans chaque cellule en `text-fg-subtle`.
- **Grands nombres seuls** (solde, KPI) en chiffres proportionnels. **Colonnes, listes, champs, axes :** `tabular-nums`.
- **Compact** (axes, puces, cartes étroites uniquement) : `48,2 k`, `1,3 M`.
- **Pourcentages :** `75 %`, `8,2 %` (une décimale sous 10), `< 1 %`.
- **Tarifs :**
  - forme pleine « 150 DA / 1 000 vues » ;
  - forme courte « 150 DA / 1k vues » sur les puces et les cartes seulement ;
  - « /1K » est interdit.
- **Dates :** `12 oct. 2026`, heure `11:58`. Le relatif (« Il y a 5 min ») est réservé aux notifications et à l'activité.
- **Comptes et références :**
  - `font-mono`, groupés par 4, avec un bouton Copier ;
  - masquage sur les chiffres seuls : `•••• 7890`.
- **Pluriel :** 0 et 1 au singulier (`0 vue`, `1 clip`, `2 clips`).
- **Espace insécable** avant « ? », « ! », « : » et « % » dans les textes visibles (`&nbsp;` en JSX, `${NB}` en JS).

### 3.4 Couleurs

Toutes les couleurs sont des tokens `--color-*`. Les templates n'utilisent **jamais** de hex ni de couleur de la palette Tailwind. Seules exceptions : les glyphes SVG du drapeau et les couvertures `.cover` (définies dans le CSS du thème).

**Neutres** (contraste mesuré sur la surface du mode)

| Token | Clair | Sombre | Usage | Contraste clair / sombre |
|---|---|---|---|---|
| `canvas` | `#f5f6f8` | `#0b0d12` | Fond de l'app, barre latérale, sections alternées du landing | — |
| `surface` | `#ffffff` | `#12151c` | Cartes, tableaux, champs, fond du landing | — |
| `surface-raised` | `#ffffff` | `#191d26` | Modales, popovers, notifications, segment actif | — |
| `subtle` | `#f0f2f5` | `#161a22` | Tuiles internes, en-tête de tableau, survol de ligne, pied de modale | — |
| `muted` | `#e8ebf0` | `#1f2430` | Survol `ghost`, pistes de progression, pastilles neutres | — |
| `line` | `#e3e6eb` | `#252a35` | Bordure de carte, séparateurs | — |
| `line-strong` | `#cdd2da` | `#353c4a` | Bordure de champ et de bouton secondaire | — |
| `line-control` | `#808897` | `#6b7383` | Interrupteur éteint, survol de champ (≥ 3:1) | 3,18 sur canvas / 3,83 |
| `fg` | `#1f2430` | `#edeff3` | Texte principal, chiffres | 15,5 / 15,9 |
| `fg-muted` | `#4b5263` | `#a4abb8` | Texte secondaire, descriptions, libellés KPI | 7,8 / 7,9 |
| `fg-subtle` | `#5f6676` | `#868e9d` | Méta, dates, aides, en-têtes de tableau, axes, placeholders | ≥ 4,82 sur toutes les surfaces / 5,5 (4,8 sur muted) |
| `fg-disabled` | `#9aa1ad` | `#5a6170` | Texte désactivé uniquement | exempté |
| `inverse` / `fg-inverse` | `#1f2430` / `#fff` | `#e9ecf1` / `#12151c` | Toasts, infobulles | 15,5 / 15,4 |
| `overlay` | `rgb(15 18 25 / .48)` | `rgb(0 0 0 / .64)` | Fond des modales et du tiroir | — |
| `focus` | `#7c3aed` | `#a78bfa` | Anneau de focus | 5,3 / 7,1 |

**Fixes** (ne basculent jamais) :
- `on-brand` `#ffffff` : texte ou fond blanc posé sur violet, nuit, couverture ou avatar ;
- `night` `#11141b`, `night-raised` `#1b1f29`, `night-line` `#2b303c` : panneau auth, CTA final, puce de tarif sur couverture ;
- `night-income` `#5eead4` : courbe sur `night` ;
- `avatar-1` à `avatar-6` : `#7c3aed #0f766e #b45309 #0369a1 #be185d #475569`, blanc dessus ≥ 5:1.

Texte blanc sur les fonds colorés fixes, avec des minimums mesurés :
- sur `night` : `text-on-brand` (principal), `text-on-brand/80` (secondaire, 11,9:1) et `text-on-brand/65` (méta, 8,2:1) ;
- sur `brand` ou `brand-panel` : `text-on-brand` et `text-on-brand/90` seulement (4,9:1 sur `#7c3aed`). Avec `/80`, on tombe à 4,2:1 : c'est un **échec**.
- Rien de plus pâle.

**Marque** (gamme identique dans les deux modes, seuls les alias basculent)

| Alias | Clair | Sombre | Usage |
|---|---|---|---|
| `brand` | `#7c3aed` | `#7c3aed` | Bouton primaire, interrupteur allumé, progression, point non lu (blanc dessus : 5,7:1) |
| `brand-hover` / `brand-active` | `#6d28d9` / `#5b21b6` | idem | Survol et appui |
| `brand-fg` | `#6d28d9` | `#a78bfa` | Liens, icône active, texte de marque (7,1 / 6,7) |
| `brand-soft` / `brand-soft-hover` | `#f5f3ff` / `#ede9fe` | `#211a39` / `#291d4a` | Sélection : choix coché, puce active, non lu |
| `brand-line` | `#c4b5fd` | `#3b2a78` | Bordure de badge et de carte mise en avant |
| `brand-panel` | `#7c3aed` | `#4c1d95` | Grande surface violette (carte « Marque » du landing) ; blanc dessus 5,7 / 10,9 |
| `brand-50` … `brand-950` | gamme Tailwind violet | idem | Uniquement `text-brand-700` sur `bg-on-brand` et `hover:bg-brand-50` du bouton blanc |

**Statuts** (`bg` et `fg` pour badges et alertes, `border` pour leur contour, `solid` pour points, barres et remplissages)

| Ton | `-bg` | `-fg` | `-border` | `-solid` | fg/bg clair / sombre |
|---|---|---|---|---|---|
| `success` | `#effaf7` / `#0f2a27` | `#0f766e` / `#5eead4` | `#b3e6dc` / `#19443f` | `#0d9488` / `#2dd4bf` | 5,1 / 10,3 |
| `warning` | `#fff8eb` / `#2d2410` | `#b45309` / `#fcd34d` | `#fcdca4` / `#4d3b14` | `#d97706` / `#fbbf24` | 4,75 / 10,6 |
| `danger` | `#fff1f3` / `#36141c` | `#be123c` / `#fda4af` | `#fecdd6` / `#5c1f2d` | `#e11d48` (fixe) | 5,7 / 8,7 |
| `info` | `#eff8ff` / `#0c2433` | `#0369a1` / `#7dd3fc` | `#bfe3fb` / `#15405a` | `#0284c7` / `#38bdf8` | 5,5 / 9,6 |
| `idle` (pause, terminé) | `#f0f2f5` / `#1d222c` | `#4b5263` / `#a4abb8` | `#dde1e7` / `#2c3240` | `#8a92a0` / `#6b7383` | 7,0 / 6,9 |

- `danger-solid-hover` vaut `#be123c` dans les deux modes (blanc dessus 6,3).
- **Aucun texte sur `success-solid`** (blanc dessus 3,74:1).

**Argent :**
- `income` `#0f766e` / `#2dd4bf` : texte 5,5 / 9,8, courbe et barres de revenus ;
- `income-soft` `#effaf7` / `#0f2a27` : pastille d'une opération entrante.

`success` qualifie un **statut**, `income` un **flux d'argent**.

**Graphiques :** voir §5. **Toasts :** couleur de l'icône sur `inverse` :
- `toast-success` `#5eead4` / `#0f766e` ;
- `toast-danger` `#fda4af` / `#be123c` ;
- `toast-info` `#c4b5fd` / `#6d28d9`.

### 3.5 Rayons, élévation, focus, mouvement, grille

| Rayon | Valeur | Usage |
|---|---|---|
| `rounded-badge` | 6 px | Badges, tags, puce de tarif |
| `rounded-lg` (Tailwind) | 8 px | Boutons `sm`, éléments de nav, boutons icône, segments |
| `rounded-control` | 10 px | Champs, boutons `md`/`lg`, cartes de choix, toasts, alertes |
| `rounded-tile` | 12 px | Tuiles internes, vignettes, symbole du logo, couverture insérée |
| `rounded-card` | **20 px** | Cartes, tableaux, KPI, panneau de notifications |
| `rounded-panel` | 24 px | Modales, feuille mobile, cadres du landing, CTA final |
| `rounded-full` | — | Avatars, puces de filtre, pistes, interrupteurs |

**Élévation**, avec des valeurs qui basculent via `--elev-*` (§3.7) :
- `shadow-control` : champs, boutons, segment actif ;
- `shadow-card` : cartes, **toujours avec** `border border-line` ;
- `shadow-card-hover` : carte interactive au survol, sans translation ;
- `shadow-popover` : notifications, toasts, puce flottante ;
- `shadow-modal` : modales, tiroir, visuel héros.
- **Aucune ombre colorée.** En sombre, l'élévation se lit d'abord par la surface (`surface`, puis `surface-raised`).

**Focus :**
- **Global** (couche base) : `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`.
- **Explicite** : `FOCUS` = `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`.
- **Champs** : `focus:border-focus focus:outline-hidden focus:ring-3 focus:ring-focus/20`.
- **Cartes de choix** : `has-focus-visible:outline-*`.

**Mouvement :**
- **Durées :**
  - 150 ms : survol, appui ;
  - 160 à 200 ms : popover, toast ;
  - 220 ms : modale ;
  - 240 à 260 ms : tiroir, feuille ;
  - 300 ms : progression.
  - Jamais plus de 300 ms.
- **Courbes :** `ease-standard` pour les états, `ease-enter` pour les entrées.
- `prefers-reduced-motion: reduce` neutralise tout (règle globale).
- Aucun `hover:-translate-y`.

**Grille :**
- **Contenu de l'app :** `mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8`.
- **Écarts :**
  - entre cartes : `gap-4 lg:gap-5` ;
  - entre sections : `mt-8` ;
  - sous l'en-tête de page : `mt-6`.
- **Cartes :** `p-5` (KPI `p-4 sm:p-5`).
- **Lignes de tableau :** `h-14`.
- **Coquille :** barre latérale `w-[17rem]` (nom et email longs renvoyés à la ligne, §4.8), barre du haut `h-14`.
- **Cibles tactiles :** au moins 40 px sous `md`.

### 3.6 Fichiers et branchement (lot A)

```
app/theme.css      NOUVEAU : seule source des tokens, des polices, de la couche base et de .cover
app/dark.css       RÉDUIT : uniquement html.dark { --color-*: … } (bascule de variables)
app/globals.css    @import "tailwindcss" + exclusions de scan + theme.css + dark.css
web/styles.css     @import "tailwindcss" source(none) + theme.css + dark.css
web/build.mjs      inline les 4 woff2 en base64 dans le CSS compilé
app/layout.tsx     inchangé (vérifier body "font-sans antialiased" et le script theme-init)
web/index.html     loader en tokens
package.json       devDependencies : les 2 paquets Fontsource
```

Installation (A, une seule fois) :

```bash
npm i -D @fontsource-variable/geist@5.3.0 @fontsource-variable/plus-jakarta-sans@5.3.0
```

Ce sont des devDependencies : les polices sont inlinées au build (`/espace`) ou copiées par Next dans `/_next/static/media` (landing). Il n'y a **aucune dépendance JS d'exécution**.

**Mécanique du sombre :**
- `@theme static` émet toutes les variables avec les valeurs claires.
- `html.dark` (classe posée par `web/theme.js` et `app/theme-init.ts`, inchangés) les redéfinit.
- Les utilitaires `bg-surface`, `text-fg-muted`… pointent vers `var(--color-…)` : ils basculent seuls.
- Les ombres passent par `--shadow-x: var(--elev-x)`, avec `--elev-*` défini sur `:root` puis redéfini sous `html.dark`.
- Vérifié à la compilation :
  - `shadow-card` donne `--tw-shadow: var(--elev-card)` ;
  - `bg-surface/90` donne `color-mix(… var(--color-surface) …)` avec un repli.

### 3.7 `app/theme.css` (complet, à copier tel quel)

```css
/*
 * app/theme.css — Thème ClipBoost : seule source des tokens (couleurs claires, typographie, rayons,
 * ombres, mouvement) et des polices. Importé par app/globals.css (Next.js) et web/styles.css (/espace).
 * Les valeurs sombres sont dans app/dark.css (bascule de variables sous html.dark, rien d'autre).
 */

@custom-variant dark (&:where(.dark, .dark *));

/* ---------- Polices : Geist (interface, chiffres) + Plus Jakarta Sans (titres, logo) ----------
   latin + latin-ext uniquement. Chemin relatif identique depuis app/ et web/ (un niveau sous la racine).
   web/build.mjs remplace ces url() par des data: base64 ; Next.js les émet dans /_next/static/media. */
@font-face {
  font-family: "Geist Variable"; font-style: normal; font-display: swap; font-weight: 100 900;
  src: url("../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Geist Variable"; font-style: normal; font-display: swap; font-weight: 100 900;
  src: url("../node_modules/@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "Plus Jakarta Sans Variable"; font-style: normal; font-display: swap; font-weight: 200 800;
  src: url("../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Plus Jakarta Sans Variable"; font-style: normal; font-display: swap; font-weight: 200 800;
  src: url("../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-wght-normal.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

@theme static {
  /* ---------- Typographie ---------- */
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-display: "Plus Jakarta Sans Variable", "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --text-micro: 0.6875rem;   --text-micro--line-height: 0.875rem;
  --text-small: 0.8125rem;   --text-small--line-height: 1.125rem;
  --text-section: 1rem;      --text-section--line-height: 1.5rem;   --text-section--letter-spacing: -0.01em;  --text-section--font-weight: 700;
  --text-heading: 1.125rem;  --text-heading--line-height: 1.625rem; --text-heading--letter-spacing: -0.015em; --text-heading--font-weight: 700;
  --text-title-sm: 1.375rem; --text-title-sm--line-height: 1.75rem; --text-title-sm--letter-spacing: -0.02em; --text-title-sm--font-weight: 750;
  --text-title: 1.625rem;    --text-title--line-height: 2rem;       --text-title--letter-spacing: -0.025em;   --text-title--font-weight: 750;
  --text-kpi: 1.625rem;      --text-kpi--line-height: 2rem;         --text-kpi--letter-spacing: -0.02em;      --text-kpi--font-weight: 600;
  --text-money: 2.25rem;     --text-money--line-height: 2.5rem;     --text-money--letter-spacing: -0.03em;    --text-money--font-weight: 600;
  --text-h2: 1.875rem;       --text-h2--line-height: 2.25rem;       --text-h2--letter-spacing: -0.025em;      --text-h2--font-weight: 750;
  --text-h1: 2.5rem;         --text-h1--line-height: 2.875rem;      --text-h1--letter-spacing: -0.03em;       --text-h1--font-weight: 800;
  --text-display: 3.5rem;    --text-display--line-height: 3.875rem; --text-display--letter-spacing: -0.035em; --text-display--font-weight: 800;

  /* ---------- Rayons ---------- */
  --radius-badge: 0.375rem;   /*  6 px : badges, tags, puce de tarif */
  --radius-control: 0.625rem; /* 10 px : boutons md/lg, champs, cartes de choix, toasts */
  --radius-tile: 0.75rem;     /* 12 px : tuiles internes, vignettes, logo */
  --radius-card: 1.25rem;     /* 20 px : cartes, tableaux, KPI (identité DROPP) */
  --radius-panel: 1.5rem;     /* 24 px : modales, feuille mobile, cadres du landing */

  /* ---------- Ombres (valeurs dans --elev-*, qui basculent dans dark.css) ---------- */
  --shadow-control: var(--elev-control);
  --shadow-card: var(--elev-card);
  --shadow-card-hover: var(--elev-card-hover);
  --shadow-popover: var(--elev-popover);
  --shadow-modal: var(--elev-modal);

  /* ---------- Mouvement ---------- */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --animate-fade-in: fade-in 160ms var(--ease-enter) both;
  --animate-pop-in: pop-in 160ms var(--ease-enter) both;
  --animate-toast-in: toast-in 200ms var(--ease-enter) both;
  --animate-modal-in: modal-in 220ms var(--ease-enter) both;
  --animate-sheet-in: sheet-in 260ms var(--ease-enter) both;
  --animate-drawer-in: drawer-in 240ms var(--ease-enter) both;
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pop-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes modal-in { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
  @keyframes sheet-in { from { transform: translateY(100%); } to { transform: none; } }
  @keyframes drawer-in { from { transform: translateX(-100%); } to { transform: none; } }

  /* ---------- Couleurs : valeurs CLAIRES (app/dark.css les redéfinit sous html.dark) ---------- */
  --color-canvas: #f5f6f8;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-subtle: #f0f2f5;
  --color-muted: #e8ebf0;
  --color-line: #e3e6eb;
  --color-line-strong: #cdd2da;
  --color-line-control: #808897;
  --color-fg: #1f2430;
  --color-fg-muted: #4b5263;
  --color-fg-subtle: #5f6676;
  --color-fg-disabled: #9aa1ad;
  --color-inverse: #1f2430;
  --color-fg-inverse: #ffffff;
  --color-overlay: rgb(15 18 25 / 0.48);
  --color-focus: #7c3aed;

  /* Fixes (ne basculent jamais) */
  --color-on-brand: #ffffff;          /* texte ET fond blanc posé sur violet, nuit ou couverture */
  --color-night: #11141b;             /* panneaux toujours sombres : auth, CTA final, puces sur couverture */
  --color-night-raised: #1b1f29;
  --color-night-line: #2b303c;
  --color-night-income: #5eead4;     /* courbe et point sur bg-night */
  --color-avatar-1: #7c3aed;
  --color-avatar-2: #0f766e;
  --color-avatar-3: #b45309;
  --color-avatar-4: #0369a1;
  --color-avatar-5: #be185d;
  --color-avatar-6: #475569;

  --color-brand-50: #f5f3ff;
  --color-brand-100: #ede9fe;
  --color-brand-200: #ddd6fe;
  --color-brand-300: #c4b5fd;
  --color-brand-400: #a78bfa;
  --color-brand-500: #8b5cf6;
  --color-brand-600: #7c3aed;
  --color-brand-700: #6d28d9;
  --color-brand-800: #5b21b6;
  --color-brand-900: #4c1d95;
  --color-brand-950: #2e1065;
  --color-brand: #7c3aed;
  --color-brand-hover: #6d28d9;
  --color-brand-active: #5b21b6;
  --color-brand-fg: #6d28d9;
  --color-brand-soft: #f5f3ff;
  --color-brand-soft-hover: #ede9fe;
  --color-brand-line: #c4b5fd;
  --color-brand-panel: #7c3aed;

  --color-success-bg: #effaf7;  --color-success-fg: #0f766e;  --color-success-border: #b3e6dc;  --color-success-solid: #0d9488;
  --color-warning-bg: #fff8eb;  --color-warning-fg: #b45309;  --color-warning-border: #fcdca4;  --color-warning-solid: #d97706;
  --color-danger-bg: #fff1f3;   --color-danger-fg: #be123c;   --color-danger-border: #fecdd6;   --color-danger-solid: #e11d48;
  --color-danger-solid-hover: #be123c;
  --color-info-bg: #eff8ff;     --color-info-fg: #0369a1;     --color-info-border: #bfe3fb;     --color-info-solid: #0284c7;
  --color-idle-bg: #f0f2f5;     --color-idle-fg: #4b5263;     --color-idle-border: #dde1e7;     --color-idle-solid: #8a92a0;

  --color-income: #0f766e;
  --color-income-soft: #effaf7;

  --color-chart-1: #7c3aed;
  --color-chart-2: #0284c7;
  --color-chart-3: #d97706;
  --color-chart-4: #db2777;
  --color-chart-income: #0f766e;
  --color-chart-brand: #7c3aed;
  --color-chart-grid: #eceef2;
  --color-chart-axis: #cdd2da;

  --color-toast-success: #5eead4;
  --color-toast-danger: #fda4af;
  --color-toast-info: #c4b5fd;
}

:root {
  color-scheme: light;
  --elev-control: 0 1px 2px 0 rgb(16 24 40 / 0.05);
  --elev-card: 0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.03);
  --elev-card-hover: 0 4px 12px -2px rgb(16 24 40 / 0.08), 0 1px 3px 0 rgb(16 24 40 / 0.05);
  --elev-popover: 0 12px 32px -6px rgb(16 24 40 / 0.14), 0 2px 6px -1px rgb(16 24 40 / 0.06);
  --elev-modal: 0 24px 64px -16px rgb(16 24 40 / 0.28), 0 4px 12px -4px rgb(16 24 40 / 0.08);
  --cover-filter: none;
}

@layer base {
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  body {
    background-color: var(--color-surface);
    color: var(--color-fg);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3, .font-display { font-family: var(--font-display); }
  h1, h2, h3 { text-wrap: balance; }
  p { text-wrap: pretty; }
  ::selection { background-color: color-mix(in oklab, var(--color-brand) 22%, transparent); }
  ::placeholder { color: var(--color-fg-subtle); opacity: 1; }
  :focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  table, .num { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer components {
  /* Compatibilité : anciens boutons de thème (le nouveau balisage utilise dark:hidden / hidden dark:block). */
  .theme-sun { display: none; }
  .dark .theme-sun { display: block; }
  .dark .theme-moon { display: none; }

  /* Couvertures de campagne : la teinte vient de la catégorie (data-cat), jamais d'une classe stockée en base. */
  .cover {
    --cover-from: #94a3b8;
    --cover-to: #475569;
    background-image:
      radial-gradient(120% 90% at 0% 0%, rgb(255 255 255 / 0.24), transparent 55%),
      linear-gradient(135deg, var(--cover-from), var(--cover-to));
    filter: var(--cover-filter);
  }
  .cover[data-cat="Sport"]   { --cover-from: #34d399; --cover-to: #0f766e; }
  .cover[data-cat="Food"]    { --cover-from: #fbbf24; --cover-to: #ea580c; }
  .cover[data-cat="Tech"]    { --cover-from: #60a5fa; --cover-to: #4f46e5; }
  .cover[data-cat="Mode"]    { --cover-from: #f472b6; --cover-to: #be185d; }
  .cover[data-cat="Musique"] { --cover-from: #a78bfa; --cover-to: #6d28d9; }
  .cover[data-cat="Humour"]  { --cover-from: #22d3ee; --cover-to: #0e7490; }
}
```

### 3.8 `app/dark.css` (complet, remplace les 75 règles actuelles)

```css
/*
 * app/dark.css — Mode sombre ClipBoost : uniquement la bascule des variables de app/theme.css
 * sous html.dark (classe posée par theme.js / theme-init.ts). Aucune règle de classe ici :
 * les utilitaires sémantiques (bg-surface, text-fg-muted…) basculent seuls.
 */
html.dark {
  color-scheme: dark;

  --color-canvas: #0b0d12;
  --color-surface: #12151c;
  --color-surface-raised: #191d26;
  --color-subtle: #161a22;
  --color-muted: #1f2430;
  --color-line: #252a35;
  --color-line-strong: #353c4a;
  --color-line-control: #6b7383;
  --color-fg: #edeff3;
  --color-fg-muted: #a4abb8;
  --color-fg-subtle: #868e9d;
  --color-fg-disabled: #5a6170;
  --color-inverse: #e9ecf1;
  --color-fg-inverse: #12151c;
  --color-overlay: rgb(0 0 0 / 0.64);
  --color-focus: #a78bfa;

  --color-brand-fg: #a78bfa;
  --color-brand-soft: #211a39;
  --color-brand-soft-hover: #291d4a;
  --color-brand-line: #3b2a78;
  --color-brand-panel: #4c1d95;

  --color-success-bg: #0f2a27;  --color-success-fg: #5eead4;  --color-success-border: #19443f;  --color-success-solid: #2dd4bf;
  --color-warning-bg: #2d2410;  --color-warning-fg: #fcd34d;  --color-warning-border: #4d3b14;  --color-warning-solid: #fbbf24;
  --color-danger-bg: #36141c;   --color-danger-fg: #fda4af;   --color-danger-border: #5c1f2d;
  --color-info-bg: #0c2433;     --color-info-fg: #7dd3fc;     --color-info-border: #15405a;     --color-info-solid: #38bdf8;
  --color-idle-bg: #1d222c;     --color-idle-fg: #a4abb8;     --color-idle-border: #2c3240;     --color-idle-solid: #6b7383;

  --color-income: #2dd4bf;
  --color-income-soft: #0f2a27;

  --color-chart-1: #8b5cf6;
  --color-chart-2: #0891b2;
  --color-chart-4: #e0457b;
  --color-chart-income: #2dd4bf;
  --color-chart-brand: #8b5cf6;
  --color-chart-grid: #1c212a;
  --color-chart-axis: #353c4a;

  --color-toast-success: #0f766e;
  --color-toast-danger: #be123c;
  --color-toast-info: #6d28d9;

  --elev-control: 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --elev-card: 0 1px 2px 0 rgb(0 0 0 / 0.5);
  --elev-card-hover: 0 6px 16px -4px rgb(0 0 0 / 0.6);
  --elev-popover: 0 16px 40px -8px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.04);
  --elev-modal: 0 32px 80px -16px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(255 255 255 / 0.05);
  --cover-filter: saturate(0.9) brightness(0.88);
}
```

`brand`, `brand-hover`, `brand-active`, `danger-solid`, `chart-3`, `on-brand`, `night*` et `avatar-*` ne basculent pas : c'est voulu (le blanc sur violet garde 5,7:1).

### 3.9 Points d'entrée

**`app/globals.css`** (complet)

```css
@import "tailwindcss";
/* Le landing ne scanne ni l'app (/espace a son propre CSS) ni la documentation :
   sinon des classes comme bg-white, citées dans docs/ ou web/offline/landing.js, seraient générées. */
@source not "../web";
@source not "../docs";
@import "./theme.css";
@import "./dark.css";
```

**`web/styles.css`** (complet)

```css
@import "tailwindcss" source(none);
@source "./src/*.js";
@source "./index.html";
@import "../app/theme.css";
@import "../app/dark.css";

/* L'app vit sur canvas, en 14 px par défaut (le landing reste sur surface, en 16 px). */
@layer base {
  body { background-color: var(--color-canvas); font-size: var(--text-sm); line-height: var(--text-sm--line-height); }
}
```

L'ancien `@keyframes toast-in` de ce fichier disparaît : il est dans `theme.css` (`animate-toast-in`).

**`web/build.mjs`** : remplacer la ligne `const { css } = await postcss(…)` par :

```js
const { css: compiled } = await postcss([tailwind({ base: dir, optimize: true })]).process(readFileSync(cssPath, "utf8"), { from: cssPath });
// Polices : les url() Fontsource de app/theme.css deviennent des data: base64 (fichier autonome, aucune requête).
const fontDir = join(dir, "..", "node_modules", "@fontsource-variable");
const css = compiled.replace(/url\((["']?)[^)"']*@fontsource-variable\/([^/]+)\/files\/([^)"']+\.woff2)\1\)/g,
  (_, _q, pkg, file) => `url(data:font/woff2;base64,${readFileSync(join(fontDir, pkg, "files", file)).toString("base64")})`);
if ((css.match(/data:font\/woff2/g) || []).length !== 4) throw new Error("Polices non inlinées : lancez npm install.");
```

Le reste du fichier est inchangé : `css` alimente les deux sorties (`/espace` et `--offline`).

Pour le hors ligne, `web/offline/build.mjs` inline déjà les `url(/_next/…)` du CSS du landing. La police émise par Next y est donc incluse sans modification.

**`app/layout.tsx`** :
- garder `import "./globals.css"`, le script `themeInitScript` et `<body className="font-sans antialiased">` (`font-sans` vaut maintenant Geist) ;
- aucun import de police : les `@font-face` de `theme.css` sont résolus par Next (`../node_modules/…` depuis `app/`).
- **Plan de secours, uniquement si `next build` échoue sur ces `url()` :**
  - déplacer les 4 blocs `@font-face` de `app/theme.css` vers `web/styles.css` (même chemin relatif, même profondeur) ;
  - ajouter dans `layout.tsx` :
    ```ts
    import "@fontsource-variable/geist/wght.css";
    import "@fontsource-variable/plus-jakarta-sans/wght.css";
    ```
    Les familles déclarées (« Geist Variable », « Plus Jakarta Sans Variable ») sont identiques.

**`web/index.html`** : seul le loader change.

```html
<div id="app"><div class="grid min-h-dvh place-items-center bg-canvas text-small text-fg-subtle">Chargement…</div></div>
```

### 3.10 Table de migration (à appliquer à la lettre)

**Surfaces**

| Actuel | Remplacement |
|---|---|
| `bg-white` (carte, tableau, champ, panneau) | `bg-surface` |
| `bg-white` (modale, popover, notifications) | `bg-surface-raised` |
| `bg-white` (bouton blanc sur violet ou sur `night`) | `bg-on-brand text-brand-700 hover:bg-brand-50` (= `btn("onColor")`) |
| `bg-white/85`, `/90`, `/95` (en-têtes collants, nav mobile) | `bg-surface/90 backdrop-blur-md` (barre du haut de l'app : `bg-canvas/85`) |
| `bg-white/90` (bouton favori, badge sur couverture) | `bg-on-brand/90 text-night` |
| `bg-white/10`, `/15`, `ring-white/20` (sur fond sombre ou couverture) | `bg-on-brand/10`, `bg-on-brand/15`, `ring-on-brand/25` |
| `bg-white/70`, `hover:bg-white` (nav latérale) | `NAV_ITEM` (§6.1) |
| `bg-gray-50` (fond de page, barre latérale) | `bg-canvas` |
| `bg-gray-50` (puits, tuile interne, en-tête de tableau) | `bg-subtle` |
| `bg-gray-100` (pistes, pastilles neutres) | `bg-muted` |
| `bg-gray-200` (interrupteur éteint) | `bg-line-control` |
| `bg-ink` (bouton) | `btn("primary")` ou `btn("secondary")` : plus aucun bouton encre |
| `bg-ink` (barre latérale admin) | coquille commune `bg-canvas` |
| `bg-ink` (panneau auth, CTA final) | `bg-night text-on-brand` |
| `bg-ink/90` (puce de tarif sur couverture) | `bg-night/80 text-on-brand backdrop-blur-sm` |
| `bg-ink/40` (fond de modale ou de tiroir) | `bg-overlay` |
| `hover:bg-black`, `hover:bg-brand-700` | `hover:bg-brand-hover` |
| `hover:bg-gray-50` / `hover:bg-gray-100` | `hover:bg-subtle` / `hover:bg-muted` |

**Texte**

| Actuel | Remplacement |
|---|---|
| `text-ink`, `text-gray-900/800/700` | `text-fg` |
| `text-gray-600`, `text-gray-500` (description, libellé) | `text-fg-muted` |
| `text-gray-500` (date, aide, compteur), `text-gray-400`, `placeholder:text-gray-400` | `text-fg-subtle` |
| `text-gray-200` (« #1 », « 01 ») | `text-fg-subtle` ou supprimer |
| `hover:text-ink` | `hover:text-fg` |
| `text-white` (sur violet, `night`, couverture, avatar) | `text-on-brand` (secondaire : `/90` sur violet, `/80` sur `night`) |
| `text-brand-600`, `text-brand-700` (sur surface) | `text-brand-fg` |
| `text-emerald-*` (statut) / (montant entrant) | `text-success-fg` / `text-income` |
| `text-amber-*` | `text-warning-fg` |
| `text-rose-*`, `text-red-*` | `text-danger-fg` (cœur favori : `text-danger-solid`) |
| `text-sky-*` | `text-info-fg` |
| `text-amber-400` (étoiles) | supprimer |

**Bordures, anneaux, focus**

| Actuel | Remplacement |
|---|---|
| `ring-1 ring-gray-100` (carte) | `border border-line` + `shadow-card` |
| `ring-1 ring-gray-200` (bouton, pastille, filtre) | `border border-line-strong` |
| `border-gray-100`, `divide-gray-100` | `border-line`, `divide-line` |
| `border-gray-200` (champ) | `border-line-strong` |
| `border-white` (avatars empilés) | `ring-2 ring-surface` |
| `focus:border-brand-500 focus:ring-4 focus:ring-brand-100`, `outline-none` | `focus:border-focus focus:outline-hidden focus:ring-3 focus:ring-focus/20` (dans `inputCls`) |
| `border-rose-300`, `focus:ring-rose-100` | `aria-invalid="true"` sur le champ (styles dans `inputCls`) |
| `ring-2 ring-brand-500` (sélection) | `border-brand` ; survol `hover:border-line-control` |
| `peer-checked:ring-brand-500`, `has-[:checked]:ring-brand-500` | `peer-checked:border-brand`, `has-checked:border-brand` (`SEG_CHOICE`, `CHOICE`) |
| `ring-brand-100` | `border-brand-line` |
| `has-[:checked]:ring-rose-300 has-[:checked]:bg-rose-50` | `CHOICE_DANGER` |

**Marque et statuts**

| Actuel | Remplacement |
|---|---|
| `bg-brand-600` (+ `hover:bg-brand-700`) | `bg-brand hover:bg-brand-hover` (`btn("primary")`) |
| `bg-brand-50`, `peer-checked:bg-brand-50` | `bg-brand-soft`, `peer-checked:bg-brand-soft` |
| `bg-brand-100`, `hover:bg-brand-100` | `bg-brand-soft-hover`, `hover:bg-brand-soft-hover` |
| `bg-brand-50/60` (non lu) | `bg-brand-soft/50` |
| `bg-emerald-50 text-emerald-600` (badge) | `badge(t, "success")` / `statusBadge(s)` |
| `bg-amber-50 text-amber-*` | `badge(t, "warning")` |
| `bg-rose-50 text-rose-*` | `badge(t, "danger")` ; bouton refuser : `btn("dangerSoft", "sm")` |
| `bg-sky-50 text-sky-*` | `badge(t, "info")` ; tag agence : `roleBadge("agence")` |
| `bg-emerald-600` (Valider, Approuver, Virement effectué, Paiement reçu) | `btn("primary", "sm")` |
| `bg-amber-50 text-amber-700` (Mettre en pause) | `btn("secondary", "sm")` + `icon("pause")` |
| `bg-emerald-50 text-emerald-700` (Reprendre, Réactiver) | `btn("secondary", "sm")` + `icon("play")` |
| `bg-rose-600` (Confirmer le refus, Supprimer) | `btn("danger")` |
| `bg-rose-500` (compteurs de nav, notifications) | `countBadge(n, "queue")` ; non lu : point `bg-brand` |
| `bg-income` (cercle plein) | `bg-income-soft text-income` (pastille `size-8`) |
| faux logo de carte (`bg-brand-600` + `bg-amber-400/90`) | tuile `bg-subtle` + `icon("bank")` ou `icon("mail")` |
| avatars `bg-rose-400`, `bg-amber-400`… | `avatar(u, size)` (palette `avatar-1` à `6`) |
| barres par plateforme `bg-pink-500`, `bg-red-500`, `bg-ink` | `barList(…, { tone: "brand" })` |
| jauge mot de passe `bg-rose-500/amber-400/emerald-*` | `bg-danger-solid` / `bg-warning-solid` / `bg-success-solid` |
| `from-* via-* to-*` (`c.gradient`) | `class="cover" ${coverAttr(c)}` ; `c.gradient` n'est plus lu |
| `accent-brand-600`, `accent-rose-600` | `accent-brand`, `accent-danger-solid` |

**Ombres, rayons, typographie**

| Actuel | Remplacement |
|---|---|
| `shadow-sm`, `shadow` (carte) / (bouton, champ) | `shadow-card` / `shadow-control` |
| `shadow-md`, `hover:shadow-md` | `hover:shadow-card-hover` |
| `shadow-xl` (popover, toast) / `shadow-2xl` (modale, tiroir, héros) | `shadow-popover` / `shadow-modal` |
| `shadow-lg`, `shadow-brand-600/25`, `shadow-*/30` | supprimer |
| `hover:-translate-y-0.5` | supprimer |
| `rounded-3xl` (carte, tableau) | `rounded-card` |
| `rounded-2xl`, `rounded-xl` (champ, bouton) / (tuile, vignette) | `rounded-control` / `rounded-tile` |
| `rounded-[2rem]`, `rounded-[2.5rem]`, `rounded-t-3xl` | `rounded-panel`, `rounded-t-panel` |
| `rounded`, `rounded-md` (badge) | `rounded-badge` |
| `text-2xl/3xl font-extrabold tracking-tight` (h1 d'app) | `pageHeader()` (`text-title-sm sm:text-title`) |
| `text-2xl font-extrabold` (titre de modale) | `modalShell({ title })` (`text-heading`) |
| `text-xl/lg font-extrabold` (h2 de section) | `sectionHeader()` (`text-heading`) ou `cardHeader()` (`text-section`) |
| `<p class="font-bold">Titre</p>` (titre de carte) | `cardHeader("Titre")` |
| `text-lg … sm:text-2xl font-extrabold` (valeur KPI) | `kpi({ value: bigMoney(n) })` ou `kpiValue(fmt(n))` |
| `text-3xl font-extrabold` (montant héros) | `bigMoney(n, "money")` |
| `text-xs font-semibold uppercase tracking-wide text-gray-400` (en-tête de tableau) | `TBL.th` (casse de phrase) |
| `font-black italic` (wordmark) | `logo()` |
| `text-[15px]` (nav), `text-[11px]` (nav mobile) | `NAV_ITEM`, `text-micro` |
| `h-4 w-4`, `h-5 w-5` | `size-4`, `size-5` |
| `min-h-screen`, `max-h-[92vh]` | `min-h-dvh`, `max-h-[92dvh]` |

**Helpers (anciens appels, nouveaux appels)**

| Ancien | Nouveau |
|---|---|
| `card(inner, cls)` | Inchangé (`<section>`, padding par défaut `p-5`, `cls` = padding + extras). Titre : `cardHeader(titre, description, actions)`. |
| `pills(name, value, options)` | `segmented(name, value, options, "Libellé du groupe")` (2 à 5 choix) ou `chips(…)` (plus, défilable). `pills` reste un alias. Les options acceptent `[valeur, libellé, compteur]`. |
| `areaChart(values)` | `barChart(values, { tone, unit, caption })` (flux) ou `cumulativeChart(values)` (cumul). `areaChart` reste comme alias, mais le garde-fou l'interdit hors de `ui.js`. |
| `modalShell(body, "max-w-xl")` | `modalShell({ title, description, body, footer, size: "lg", form: "nom" })`. Le titre `h2` et le bouton fermer sont gérés par la coquille. Retirer les `<h2>` et les boutons du corps. |
| `avatar(u, "h-16 w-16 text-xl")` | `avatar(u, "lg")` (`xs`, `sm`, `md`, `lg`, `xl`) |
| `toast("Clip envoyé ✓")` | `toast("Clip envoyé")` ; erreur : `toast(msg, "danger")` |
| `field(label, input, hint)` | `field(label, input, hint, error)` ; le champ en erreur porte `aria-invalid="true"` |
| `countrySelect(name, value, cls)` | `countrySelect(name, value)` |
| `select(name, value, options, cls)` | Inchangé, ou `select(name, value, options, { label, cls })` |
| `logo(true)` | `logo({ tone: "text-on-brand" })` |
| `icon(n, "h-4 w-4")` | `icon(n, "size-4")` ; dans un bouton, la taille vient du bouton (`[&_svg]:size-4`) : `icon(n)` suffit |
| `"− " + da(n)`, `"+" + da(n)` | `daSigned(n)` (texte) ou `money(n, { signed: true })` (HTML) |
| `` `${fmt(v)} vues` `` | `plural(v, "vue", "vues")` |
| `` `${c.rate} DA / 1K` `` | `rate(c.rate)` (forme pleine) ou `rateShort(c.rate)` (puces) |
| `<input class="${inputCls}">` hors `field()` | Garder `inputCls` ; l'ancien `mt-1.5` a disparu, l'écart vient de `field()` (`grid gap-1.5`) |

### 3.11 Garde-fou (avant de rendre un lot)

```bash
grep -rnP --include=*.js --include=*.tsx --include=*.ts \
  '\b(bg|text|border|ring|divide|from|via|to|shadow|accent|fill|stroke|outline|decoration)-(white|black|ink|gray|slate|zinc|neutral|stone|red|rose|pink|fuchsia|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple)\b(-\d{2,3})?|\bshadow-(sm|md|lg|xl|2xl)\b|\brounded-(xl|2xl|3xl|\[2)|\bfont-black\b|\bdark:(?!hidden\b|block\b)[a-z]|\bhover:-translate-y|#[0-9a-fA-F]{6}\b' \
  web/src components/landing app/page.tsx \
  | grep -vP 'fill="#[0-9a-fA-F]{6}"|^[^:]+:\d+:\s*(//|\*|/\*)'
```

- **Résultat attendu : 0 ligne.** La commande a été testée : 0 ligne sur les références du §4, 469 lignes sur le code actuel.
- Seules exceptions tolérées par le filtre : les glyphes SVG du drapeau (`fill="#…"`) et les commentaires.
- `data/landing.ts` est exclu, car son champ `gradient` est conservé dans cette passe.

Contrôle des emoji d'interface (lots B à G). Il doit aussi rendre 0 ligne. `ui.js` (table `EVENT_ICON`), les lignes qui manipulent `emoji` (visuels de campagne choisis par l'agence) et les commentaires sont exclus. La commande a été testée : 45 lignes aujourd'hui.

```bash
LC_ALL=C.UTF-8 grep -rnP --exclude=ui.js '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]' web/src components/landing \
  | grep -viP 'emoji|^[^:]+:\d+:\s*//'
```

---

## 4. Recettes de composants

### 4.1 `web/src/ui.js` (lot A) : structure finale

1. **En tête de fichier, conserver tel quel** : `esc`, `MONTHS`, `ago`, `initials`, `campaignById`, `userById`, `rawEarnings`, `belowMin`, `isCapped`, `payoutOf`, `earningsOf`, `viewsFor`, `isEmail`, `copy`, `handlePasswordSubmit`, `homeOf`.
   - `date` : remplacer les espaces par `NB` (`` `${d}${NB}${MONTHS[+m - 1]}${NB}${y}` ``).
   - `handlePasswordSubmit` : le toast devient `toast("Mot de passe modifié")`.
2. **Supprimer** les anciennes définitions de :
   - formats : `fmt`, `da` ;
   - icônes et graphiques : `icons`, `icon`, `chartSeq`, `areaChart` ;
   - conteneurs : `card`, `pageHeader`, `field`, `inputCls`, `switchBtn`, `avatar`, `select`, `countrySelect`, `statusBadge`, `pills` ;
   - retours et coquille : `modalShell`, `toast`, `siteBanner`, `themeToggle`, `logo`, `accountCard`.
   - Toutes sont redéfinies ci-dessous. **Deux définitions du même nom dans le fichier final provoquent une SyntaxError.**
3. **Coller la référence ci-dessous** juste après `esc` et `MONTHS`. `NB` doit être déclaré avant le premier appel de `date()`, ce qui est le cas : les appels ont lieu au rendu.

Choix d'usage (à respecter dans les lots B à E) :

| Besoin | Helper |
|---|---|
| Montant dans une phrase, un toast, un `aria-label` | `da(n)` ; mouvement : `daSigned(n)` |
| Montant affiché (cellule, liste, carte) | `money(n)` ; historique : `money(n, { signed: true })` |
| Solde ou KPI | `bigMoney(n)` (KPI), `bigMoney(n, "money")` (solde héros) |
| Nombre non monétaire en KPI | `kpiValue(fmt(n))` ou `kpiValue(compact(n))` |
| Action principale de la zone | `btn("primary")`, une seule par zone visible |
| Action secondaire | `btn("secondary")` ; action répétée dans une grille (Rejoindre, Détails) : `btn("soft", "sm")` |
| Action discrète, Annuler | `btn("ghost")` |
| Destruction confirmée | `btn("danger")` ; avant confirmation : `btn("dangerSoft")` |
| Bouton sur violet ou sur `night` | `btn("onColor")`, `btn("onColorGhost")` |
| 2 à 5 filtres exclusifs | `segmented(action, valeur, options, "Libellé")` |
| Filtres nombreux ou catégories | `chips(…)` |
| Sections d'une même page | `TABLIST` + `TAB` (`role="tablist"`, `role="tab"`, `aria-selected`) |
| Statut | `statusBadge(s)` ; autre étiquette : `badge(texte, ton, { dot \| ic })` |
| Plateforme | `platformTag(p)` (neutre, glyphe monochrome) |
| File d'attente, non lu | `countBadge(n, "queue" \| "unread" \| "total")` |
| Liste vide | `emptyState(icône, titre, texte, action)` ; dans une carte : `{ inCard: true }` |
| Message en ligne | `alertBox("info" \| "warning" \| "danger" \| "success", html)` |
| Champ numérique avec unité | `unitInput('name="amount" value="…"', "DA")` |
| Récapitulatif d'argent | `summary([[libellé, valeurHTML], …, ["Vous recevrez", money(n), true]])` |

### 4.2 Référence `ui.js` (compilée et exécutée avant publication)

```js
// ===================== web/src/ui.js : référence du design system =====================
// Conserver tel quel (en tête de fichier) : esc, MONTHS, date, ago, initials, campaignById, userById, rawEarnings,
// belowMin, isCapped, payoutOf, earningsOf, viewsFor, isEmail, copy, handlePasswordSubmit, homeOf.

// ---------- Formats (argent, nombres) ----------
const NB = " ", MINUS = "−";
const fmt = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
const da = (n) => `${n < 0 ? MINUS : ""}${fmt(n)}${NB}DA`;                                  // texte brut : phrases, toasts, aria
const daSigned = (n) => `${n > 0 ? "+" : n < 0 ? MINUS : ""}${fmt(n)}${NB}DA`;              // mouvements : historiques, deltas
// Montant HTML en ligne ou en cellule : chiffres tabulaires, « DA » atténué. signed : vert + « + » si positif.
const money = (n, { signed = false, cls = "" } = {}) =>
  `<span class="whitespace-nowrap tabular-nums ${signed && n > 0 ? "text-income" : "text-fg"} ${cls}">${signed ? (n > 0 ? "+" : n < 0 ? MINUS : "") : n < 0 ? MINUS : ""}${fmt(n)}<span class="font-normal text-fg-subtle">${NB}DA</span></span>`;
// Grand montant (KPI, solde) : chiffres proportionnels, unité plus petite. size : "kpi" | "money".
const BIG = { kpi: ["text-xl font-semibold tracking-tight sm:text-kpi", "text-sm sm:text-base"], money: ["text-[1.875rem] leading-9 font-semibold tracking-[-0.03em] sm:text-money", "text-base sm:text-lg"] };
const bigMoney = (n, size = "kpi") =>
  `<span class="whitespace-nowrap text-fg ${BIG[size][0]}">${n < 0 ? MINUS : ""}${fmt(n)}<span class="ml-1 font-medium tracking-normal text-fg-subtle ${BIG[size][1]}">DA</span></span>`;
// Compact (axes, puces, cartes étroites) : 9 800 → « 9 800 » ; 48 200 → « 48,2 k » ; 1 250 000 → « 1,3 M ».
const compact = (n) => {
  const a = Math.abs(n), f = (v, d) => v.toFixed(d).replace(".", ",").replace(/,0$/, "");
  if (a >= 1e6) return `${n < 0 ? MINUS : ""}${f(a / 1e6, a >= 1e7 ? 0 : 1)}${NB}M`;
  if (a >= 1e4) return `${n < 0 ? MINUS : ""}${f(a / 1e3, a >= 1e5 ? 0 : 1)}${NB}k`;
  return `${n < 0 ? MINUS : ""}${fmt(a)}`;
};
const pct = (x) => (x > 0 && x < 1 ? `<${NB}1${NB}%` : `${String(x < 10 && x % 1 ? x.toFixed(1) : Math.round(x)).replace(".", ",")}${NB}%`);
const plural = (n, one, many) => `${fmt(n)}${NB}${Math.abs(n) <= 1 ? one : many}`;
const rate = (r) => `${fmt(r)}${NB}DA / 1${NB}000${NB}vues`;           // forme pleine
const rateShort = (r) => `${fmt(r)}${NB}DA / 1k${NB}vues`;              // puces et cartes uniquement
const code = (s) => `<span class="font-mono text-[0.92em] tracking-wide">${esc(s)}</span>`;
const groupAccount = (s) => esc(String(s || "").replace(/\s+/g, "")).replace(/(.{4})(?=.)/g, `$1${NB}`);

// ---------- Icônes : grille 24, trait 1,75, taille donnée par cls ou par le parent ([&_svg]:size-*) ----------
const icons = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  list: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  arrowUp: '<path d="M7 17L17 7M9 7h8v8"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  // nouvelles
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowDownLeft: '<path d="M17 7L7 17M15 17H7V9"/>',
  arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11L6 3h4l2 4 2-4h4l-2.5 8"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>',
};
const icon = (name, cls = "size-5", fill = false) =>
  `<svg viewBox="0 0 24 24" class="${cls}" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${icons[name] || ""}</svg>`;

// Événements (notifications, activité) : la base stocke un emoji, l'interface affiche une icône au trait.
const EVENT_ICON = { "✅": ["check", "bg-success-bg text-success-fg"], "🚫": ["ban", "bg-danger-bg text-danger-fg"], "⚠": ["alert", "bg-warning-bg text-warning-fg"],
  "⏳": ["clock", "bg-muted text-fg-muted"], "⚙": ["gear", "bg-muted text-fg-muted"], "🎬": ["film", "bg-muted text-fg-muted"], "🎯": ["target", "bg-muted text-fg-muted"],
  "🏁": ["flag", "bg-muted text-fg-muted"], "🏢": ["building", "bg-muted text-fg-muted"], "🏦": ["bank", "bg-muted text-fg-muted"], "💰": ["wallet", "bg-muted text-fg-muted"], "💸": ["wallet", "bg-muted text-fg-muted"] };
const eventIcon = (emoji) => {
  const [ic, tone] = EVENT_ICON[String(emoji || "").replace(/️/g, "")] || ["bell", "bg-muted text-fg-muted"];
  return `<span class="grid size-8 shrink-0 place-items-center rounded-full ${tone}" aria-hidden="true">${icon(ic, "size-4")}</span>`;
};

// Drapeau algérien (SVG, jamais d'emoji : Windows n'affiche pas les drapeaux emoji).
const flagDz = (cls = "h-3 w-[18px]") =>
  `<svg viewBox="0 0 30 20" class="${cls} shrink-0 rounded-[2px] ring-1 ring-fg/10" role="img" aria-label="Algérie"><rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#ffffff"/><mask id="dz-crescent"><rect width="30" height="20" fill="#fff"/><circle cx="16.25" cy="10" r="4" fill="#000"/></mask><circle cx="15" cy="10" r="5" fill="#d21034" mask="url(#dz-crescent)"/><polygon fill="#d21034" points="15.50,10.00 16.91,9.50 16.95,8.00 17.86,9.19 19.30,8.77 18.45,10.00 19.30,11.23 17.86,10.81 16.95,12.00 16.91,10.50"/></svg>`;

// ---------- Logo ----------
// logo() sur surface ; logo({ tone: "text-on-brand" }) sur bg-night ; logo({ wordmark: false }) : symbole seul.
// Compatibilité : logo(true) = version claire sur fond sombre.
function logo(opts = {}) {
  const o = typeof opts === "boolean" ? { tone: opts ? "text-on-brand" : "text-fg" } : opts;
  const { wordmark = true, tone = "text-fg", size = "md", href = "/" } = o;
  const S = { md: ["size-9 rounded-tile", "text-[1.375rem]"], sm: ["size-8 rounded-[10px]", "text-[1.125rem]"] }[size];
  return `<a href="${href}" class="inline-flex items-center gap-2.5 rounded-control" aria-label="ClipBoost, retour au site">
    <span class="grid ${S[0]} shrink-0 place-items-center bg-brand text-on-brand">${icon("play", "size-[18px] translate-x-px", true)}</span>
    ${wordmark ? `<span class="inline-block -skew-x-6 font-display ${S[1]} font-extrabold leading-none tracking-[-0.03em] ${tone}" aria-hidden="true">ClipBoost</span>` : ""}</a>`;
}

// ---------- Classes de base ----------
const cx = (...a) => a.filter(Boolean).join(" ");
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// ---------- Boutons ----------
const BTN = {
  base: `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${FOCUS}`,
  sm: "h-8 rounded-lg px-3 text-small [&_svg]:size-4",
  md: "h-10 rounded-control px-4 text-sm [&_svg]:size-4",
  lg: "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5",
  primary: "bg-brand text-on-brand shadow-control hover:bg-brand-hover active:bg-brand-active",
  secondary: "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle active:bg-muted",
  soft: "bg-brand-soft text-brand-fg hover:bg-brand-soft-hover",
  ghost: "text-fg-muted hover:bg-muted hover:text-fg active:bg-line",
  danger: "bg-danger-solid text-on-brand shadow-control hover:bg-danger-solid-hover",
  dangerSoft: "border border-line-strong bg-surface text-danger-fg shadow-control hover:border-danger-border hover:bg-danger-bg",
  onColor: "bg-on-brand text-brand-700 shadow-control hover:bg-brand-50",
  onColorGhost: "bg-on-brand/10 text-on-brand ring-1 ring-inset ring-on-brand/25 hover:bg-on-brand/15",
  link: "rounded-sm font-medium text-brand-fg underline-offset-4 hover:underline", // sans taille : hérite du texte parent
};
// extra ne doit jamais redéfinir une propriété déjà posée par la recette (voir « Règle des extras »).
const btn = (variant = "primary", size = "md", extra = "") => cx(BTN.base, variant === "link" ? "" : BTN[size], BTN[variant], extra);

const ICON_BTN = {
  base: `inline-grid shrink-0 place-items-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-muted hover:text-fg ${FOCUS}`,
  sm: "size-8 [&_svg]:size-4", md: "size-9 [&_svg]:size-[18px]", lg: "size-10 [&_svg]:size-5",
  outline: "border border-line-strong bg-surface shadow-control",
};
const iconBtn = (size = "md", outline = false, extra = "") => cx(ICON_BTN.base, ICON_BTN[size], outline && ICON_BTN.outline, extra);

// ---------- Champs ----------
const inputCls = "block h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-fg shadow-control transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-line-control focus:border-focus focus:outline-hidden focus:ring-3 focus:ring-focus/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-disabled read-only:bg-subtle aria-[invalid=true]:border-danger-solid aria-[invalid=true]:focus:ring-danger-solid/20 sm:text-sm";
const inputLg = "h-11";
const textareaCls = `${inputCls} h-auto min-h-24 resize-y py-2.5 leading-5`;
const selectCls = `${inputCls} cursor-pointer appearance-none pr-9`;
const CHEVRON = icon("chevronDown", "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle");

// select(name, value, options[[v, l]], { label, cls }) ; 4e argument texte = classes du conteneur (compatibilité).
function select(name, value, options, opts = {}) {
  const o = typeof opts === "string" ? { cls: opts } : opts;
  return `<label class="relative block ${o.cls || ""}">${o.label ? `<span class="sr-only">${esc(o.label)}</span>` : ""}<select data-input="${name}" class="${selectCls}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${CHEVRON}</label>`;
}
const countrySelect = (name, value) =>
  `<span class="relative block"><select name="${name}" class="${selectCls}">${COUNTRIES.map((c) => `<option${c === value ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>${CHEVRON}</span>`;
// Champ numérique avec unité en suffixe (DA, %, jours, vues). attrs : attributs bruts de l'input.
const unitInput = (attrs, unit, { lg = false } = {}) =>
  `<span class="relative block"><input ${attrs} inputmode="numeric" class="${inputCls} ${lg ? inputLg : ""} ${unit.length > 3 ? "pr-16" : "pr-12"} tabular-nums"/><span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-fg-subtle">${unit}</span></span>`;
const searchInput = (name, value, placeholder, label, cls = "") =>
  `<label class="relative block ${cls}"><span class="sr-only">${esc(label)}</span>${icon("search", "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input data-input="${name}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" class="${inputCls} pl-9"/></label>`;
// field(libellé, champ, aide, erreur) : l'erreur remplace l'aide ; poser aria-invalid="true" sur le champ en erreur.
const field = (label, input, hint = "", error = "") =>
  `<label class="grid gap-1.5"><span class="text-small font-medium text-fg">${label}</span>${input}${error
    ? `<span class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${error}</span>`
    : hint ? `<span class="text-xs text-fg-subtle">${hint}</span>` : ""}</label>`;
const OPTIONAL = `<span class="font-normal text-fg-subtle">(facultatif)</span>`;

// Cartes de choix (radio natif visible) et segments de choix (input peer sr-only).
const CHOICE = `group relative flex cursor-pointer items-start gap-3 rounded-control border border-line-strong bg-surface p-3.5 transition-colors duration-150 hover:border-line-control has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`;
const CHOICE_DANGER = `group relative flex cursor-pointer items-start gap-3 rounded-control border border-line-strong bg-surface p-3.5 transition-colors duration-150 hover:border-line-control has-checked:border-danger-solid has-checked:bg-danger-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`;
const SEG_CHOICE = "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition-colors hover:border-line-control peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus [&_svg]:size-4";
const RADIO = "mt-0.5 size-4 shrink-0 cursor-pointer accent-brand";
const CHECKBOX = `size-4 shrink-0 cursor-pointer rounded-[4px] accent-brand ${FOCUS}`;

const switchBtn = (on, action, key, label) =>
  `<button type="button" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}" aria-label="${esc(label)}" class="group relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-line-control transition-colors duration-150 ease-standard aria-checked:bg-brand ${FOCUS}"><span class="pointer-events-none ml-0.5 size-5 rounded-full bg-on-brand shadow-control transition-transform duration-150 ease-standard group-aria-checked:translate-x-4"></span></button>`;

// ---------- Cartes ----------
const CARD = "rounded-card border border-line bg-surface shadow-card";
const CARD_HOVER = `transition-[border-color,box-shadow] duration-150 ease-standard hover:border-line-strong hover:shadow-card-hover ${FOCUS}`;
const TILE = "rounded-tile bg-subtle p-3";
const card = (inner, cls = "p-5") => `<section class="${CARD} ${cls}">${inner}</section>`;
const cardHeader = (title, desc = "", actions = "") =>
  `<header class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><h2 class="text-section text-fg">${title}</h2>${desc ? `<p class="mt-0.5 text-small text-fg-muted">${desc}</p>` : ""}</div>${actions ? `<div class="flex shrink-0 items-center gap-2">${actions}</div>` : ""}</header>`;

// KPI : value = HTML (bigMoney(n) pour l'argent, sinon `<span class="text-xl font-semibold tracking-tight text-fg sm:text-kpi">${fmt(n)}</span>` via kpiValue).
const kpiValue = (txt) => `<span class="whitespace-nowrap text-xl font-semibold tracking-tight text-fg tabular-nums sm:text-kpi">${txt}</span>`;
const DELTA = { up: "bg-success-bg text-success-fg", down: "bg-danger-bg text-danger-fg", flat: "bg-muted text-fg-muted" };
function kpi({ label, value, sub = "", ic = "", delta = "", deltaTone = "up", href = "", extra = "" }) {
  const body = `<div class="flex items-center justify-between gap-2"><p class="text-small font-medium text-fg-muted">${label}</p>${ic ? `<span class="text-fg-subtle">${icon(ic, "size-4")}</span>` : ""}</div>
    <p class="mt-2">${value}</p>
    ${delta || sub ? `<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">${delta ? `<span class="inline-flex h-5 items-center gap-0.5 rounded-badge px-1.5 font-medium tabular-nums ${DELTA[deltaTone]}">${delta}</span>` : ""}${sub ? `<span>${sub}</span>` : ""}</div>` : ""}${extra}`;
  return href ? `<a href="${href}" class="block ${CARD} ${CARD_HOVER} p-4 sm:p-5">${body}</a>` : `<div class="${CARD} p-4 sm:p-5">${body}</div>`;
}

// ---------- Badges ----------
const BADGE = "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-badge border px-2 text-xs font-medium";
const TONE = {
  success: "border-success-border bg-success-bg text-success-fg", warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg", info: "border-info-border bg-info-bg text-info-fg",
  idle: "border-idle-border bg-idle-bg text-idle-fg", brand: "border-brand-line bg-brand-soft text-brand-fg",
};
const DOT = { success: "bg-success-solid", warning: "bg-warning-solid", danger: "bg-danger-solid", info: "bg-info-solid", idle: "bg-idle-solid", brand: "bg-brand" };
const STATUS_TONE = {
  "Active": "success", "Actif": "success", "Validée": "success", "Validé": "success",
  "En attente": "warning", "En cours": "info", "En pause": "idle", "Terminée": "idle",
  "Refusée": "danger", "Refusé": "danger", "Rejeté": "danger", "Suspendu": "danger",
};
const badge = (text, tone = "idle", { dot = false, ic = "" } = {}) =>
  `<span class="${BADGE} ${TONE[tone]}">${ic ? icon(ic, "size-3") : dot ? `<span class="size-1.5 rounded-full ${DOT[tone]}" aria-hidden="true"></span>` : ""}${text}</span>`;
const statusBadge = (s) => badge(esc(s), STATUS_TONE[s] || "idle", s === "En pause" ? { ic: "pause" } : { dot: true });
const PLATFORM_ICON = { TikTok: "tiktok", Instagram: "instagram", YouTube: "youtube" };
const platformTag = (p) => `<span class="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-badge bg-muted px-2 text-xs font-medium text-fg-muted">${icon(PLATFORM_ICON[p] || "film", "size-3.5")}${esc(p)}</span>`;
const roleBadge = (role) => ({ agence: `<span class="inline-flex h-5 items-center rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg">Agence</span>`, admin: `<span class="inline-flex h-5 items-center rounded-[4px] bg-brand-soft px-1.5 text-micro font-semibold text-brand-fg">Admin</span>` }[role] || "");
const COUNT = { queue: "bg-brand-soft text-brand-fg", unread: "bg-brand text-on-brand", total: "bg-muted text-fg-muted" };
const countBadge = (n, tone = "queue") => `<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${COUNT[tone]}">${fmt(n)}</span>`;

// ---------- Filtres : segmented (2 à 5 choix), chips (au-delà, défilable) ----------
// options : "Libellé" | [valeur, libellé] | [valeur, libellé, compteur]
const opt = (o) => (Array.isArray(o) ? o : [o, o]);
const segmented = (name, value, options, label = "Filtrer") =>
  `<div class="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-line bg-subtle p-0.5 [scrollbar-width:none]" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-control ${FOCUS}">${esc(l)}${n !== undefined ? `<span class="tabular-nums text-fg-subtle">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
const pills = segmented; // compatibilité
const chips = (name, value, options, label = "Filtrer") =>
  `<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors hover:border-line-control hover:text-fg aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg ${FOCUS}">${esc(l)}${n !== undefined ? `<span class="tabular-nums opacity-80">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
// Onglets soulignés (sections d'une même page).
const TABLIST = "flex gap-6 border-b border-line";
const TAB = `-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent text-sm font-medium text-fg-muted transition-colors hover:text-fg aria-selected:border-brand aria-selected:text-fg ${FOCUS}`;

// ---------- En-têtes, état vide, progression ----------
const pageHeader = (title, text, action = "") =>
  `<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0"><h1 class="text-title-sm text-fg sm:text-title">${title}</h1>${text ? `<p class="mt-1 max-w-2xl text-sm text-fg-muted">${text}</p>` : ""}</div>
    ${action ? `<div class="flex shrink-0 flex-wrap items-center gap-2">${action}</div>` : ""}</div>`;
const sectionHeader = (title, href = "", link = "Tout voir", attrs = "") =>
  `<div class="mb-3 mt-8 flex items-end justify-between gap-3"><h2 class="text-heading text-fg">${title}</h2>${href ? `<a href="${href}" ${attrs} class="inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${link}${icon("chevronRight", "size-3.5")}</a>` : ""}</div>`;
// emptyState(icône, titre, texte, action HTML, { inCard }) : inCard = à l'intérieur d'une carte existante (pas de bordure).
const emptyState = (ic, title, text = "", action = "", { inCard = false } = {}) =>
  `<div class="flex flex-col items-center justify-center px-6 text-center ${inCard ? "py-10" : "rounded-card border border-dashed border-line-strong bg-surface py-12"}">
    <span class="grid size-10 place-items-center rounded-full bg-muted text-fg-subtle">${icon(ic, "size-5")}</span>
    <p class="mt-3 text-sm font-semibold text-fg">${title}</p>${text ? `<p class="mt-1 max-w-sm text-small text-fg-muted">${text}</p>` : ""}${action ? `<div class="mt-4">${action}</div>` : ""}</div>`;
// progress(dépensé, budget, { label, aria }) : violet ; ≥ 85 % ambre ; 100 % gris. Jamais rouge.
function progress(spent, budget, { label = true, aria = "Budget utilisé" } = {}) {
  const p = budget ? (spent / budget) * 100 : 0;
  const fill = p >= 100 ? "bg-idle-solid" : p >= 85 ? "bg-warning-solid" : "bg-brand";
  return `<div>${label ? `<div class="mb-1.5 flex items-baseline justify-between gap-3 text-xs tabular-nums text-fg-subtle"><span><span class="font-medium text-fg">${fmt(spent)}</span> / ${da(budget)}</span><span>${pct(p)}</span></div>` : ""}
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, p))}" aria-label="${esc(aria)}">
      <div class="h-full rounded-full ${fill} transition-[width] duration-300 ease-standard" style="width:${p > 0 ? `max(3px, ${Math.min(100, p).toFixed(1)}%)` : "0"}"></div></div></div>`;
}

// ---------- Couvertures de campagne (catégorie → teinte, voir .cover dans app/theme.css) ----------
const coverAttr = (c) => `data-cat="${CATEGORIES.includes(c.category) ? c.category : "Autre"}"`;
const THUMB = { xs: "size-5 rounded-[4px] text-[11px]", sm: "size-10 rounded-tile text-lg", md: "size-12 rounded-tile text-2xl", lg: "size-14 rounded-tile text-2xl" };
const coverThumb = (c, size = "sm") => `<span class="cover grid ${THUMB[size]} shrink-0 place-items-center" ${coverAttr(c)} aria-hidden="true">${c.emoji}</span>`;

// ---------- Avatar : 6 fonds AA (texte blanc ≥ 5:1), admin = violet ----------
const AVATARS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5", "bg-avatar-6"];
const AVATAR_SIZE = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-small", lg: "size-16 text-xl", xl: "size-20 text-2xl" };
function avatar(u, size = "md") {
  const tone = u.role === "admin" ? "bg-avatar-1" : AVATARS[[...String(u.id)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length];
  return `<span class="inline-grid ${AVATAR_SIZE[size] || size} shrink-0 select-none place-items-center rounded-full font-semibold text-on-brand ${tone}" aria-hidden="true">${esc(initials(u.name))}</span>`;
}

// ---------- Tableau (≥ md) et liste (< md) dans le même conteneur ----------
const TBL = {
  wrap: "overflow-hidden rounded-card border border-line bg-surface shadow-card",
  table: "hidden w-full border-collapse text-sm md:table",
  headRow: "bg-subtle",
  th: "h-9 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-fg-subtle first:pl-5 last:pr-5",
  thNum: "text-right",
  tr: "border-t border-line transition-colors duration-150 hover:bg-subtle/70",
  td: "h-14 px-4 py-2 align-middle text-fg first:pl-5 last:pr-5",
  tdNum: "text-right font-medium tabular-nums whitespace-nowrap",
  tdSub: "mt-0.5 block text-xs text-fg-subtle",
  tdActions: "w-px whitespace-nowrap text-right",
  list: "divide-y divide-line md:hidden",
  item: "flex flex-col gap-3 px-4 py-3.5",
};

// ---------- Toast ----------
// toast(message, "success" | "danger" | "info"). Messages sans emoji ni « ✓ » : l'icône s'en charge.
const TOAST = { success: ["check", "text-toast-success"], danger: ["alert", "text-toast-danger"], info: ["info", "text-toast-info"] };
function toast(msg, tone = "success") {
  const box = document.getElementById("toasts");
  if (!box) return;
  const [ic, cls] = TOAST[tone] || TOAST.success;
  const el = document.createElement("div");
  el.setAttribute("role", tone === "danger" ? "alert" : "status");
  el.className = "pointer-events-auto flex max-w-md items-center gap-2.5 rounded-control bg-inverse px-4 py-3 text-sm font-medium text-fg-inverse shadow-popover animate-toast-in";
  el.innerHTML = `${icon(ic, `size-4 shrink-0 ${cls}`)}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), Math.max(3200, msg.length * 70));
}

// ---------- Modale (feuille en bas sur mobile, boîte centrée ≥ sm) ----------
// modalShell({ title, description, body, footer, size: "md" | "lg" | "xl", form: "nom-du-data-form", live: "nom" })
// Avec form, la boîte entière est le <form data-form> : les boutons du pied sont dans le formulaire.
// Avec live, chaque saisie appelle LIVE[nom](données du formulaire) et remplace le contenu de [data-live-out] (main.js).
// Compatibilité : modalShell(bodyHtml, "max-w-lg") reste accepté pendant la migration.
const MODAL_W = { md: "sm:max-w-lg", lg: "sm:max-w-xl", xl: "sm:max-w-2xl", "max-w-lg": "sm:max-w-lg", "max-w-xl": "sm:max-w-xl", "max-w-2xl": "sm:max-w-2xl" };
function modalShell(arg, legacySize = "max-w-lg") {
  const o = typeof arg === "string" ? { body: arg, size: legacySize } : arg;
  const { title = "", description = "", body, footer = "", size = "md", form = "", live = "" } = o;
  const tag = form ? "form" : "div";
  return `<div class="fixed inset-0 z-50 flex items-end justify-center bg-overlay animate-fade-in sm:items-center sm:p-6" data-action="close-modal">
    <${tag} ${form ? `data-form="${form}" novalidate` : ""} ${live ? `data-live="${live}"` : ""} data-stop role="dialog" aria-modal="true" ${title ? 'aria-labelledby="modal-title"' : ""} tabindex="-1"
      class="relative flex max-h-[92dvh] w-full ${MODAL_W[size] || MODAL_W.md} flex-col overflow-hidden rounded-t-panel border border-line bg-surface-raised shadow-modal animate-sheet-in sm:rounded-panel sm:animate-modal-in">
      <span class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden="true"></span>
      ${title ? `<header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div class="min-w-0"><h2 id="modal-title" class="text-heading text-fg">${title}</h2>${description ? `<p class="mt-0.5 text-small text-fg-muted">${description}</p>` : ""}</div>
        <button type="button" data-action="close-modal" class="${iconBtn("sm", false, "-mr-1.5 -mt-0.5")}" aria-label="Fermer">${icon("close")}</button>
      </header>` : `<button type="button" data-action="close-modal" class="${iconBtn("sm", false, "absolute right-3 top-3 z-10")}" aria-label="Fermer">${icon("close")}</button>`}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">${body}</div>
      ${footer ? `<footer class="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-3.5">${footer}</footer>` : ""}
    </${tag}></div>`;
}
// Récapitulatifs en direct : chaque fichier de zone enregistre LIVE.nom = (data) => html au niveau supérieur.
const LIVE = {};
// Récapitulatif d'argent (au-dessus du pied des modales qui touchent à l'argent).
// rows : [[libellé, valeurHTML, fort?]] ; la ligne forte est séparée par un trait.
const summary = (rows) =>
  `<dl class="mt-5 grid gap-2 rounded-tile bg-subtle p-4 text-sm">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "mt-1 border-t border-line pt-3 font-semibold text-fg" : "text-fg-muted"}"><dt>${l}</dt><dd class="tabular-nums text-right ${strong ? "" : "text-fg"}">${v}</dd></div>`).join("")}</dl>`;
// Alerte en ligne : alert("info" | "warning" | "danger" | "success", texteHTML)
const ALERT_ICON = { info: "info", warning: "alert", danger: "alert", success: "check" };
const alertBox = (tone, html) =>
  `<div class="flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm ${TONE[tone]}" role="${tone === "danger" ? "alert" : "note"}">${icon(ALERT_ICON[tone], "mt-0.5 size-4 shrink-0")}<div class="min-w-0">${html}</div></div>`;

// ---------- Carte « Compte et connexion » (Profil clipper et Profil agence) ----------
function accountCard(u) {
  const pe = state.pwdError;
  return card(`${cardHeader("Compte et connexion")}
    <div class="mt-4 flex items-center gap-3 rounded-tile bg-subtle p-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile border border-line bg-surface text-fg-muted">${icon("mail", "size-[18px]")}</span>
      <p class="min-w-0 flex-1 truncate text-sm font-medium text-fg">${esc(u.email)}</p>${badge("Vérifié", "success", { ic: "check" })}</div>
    <form data-form="password" class="mt-5 grid gap-4" novalidate>
      ${pe ? alertBox("danger", esc(pe)) : ""}
      ${field("Mot de passe actuel", `<input name="current" type="password" autocomplete="current-password" class="${inputCls}"${pe ? ' aria-invalid="true"' : ""}/>`)}
      ${field("Nouveau mot de passe", `<input name="next" type="password" autocomplete="new-password" class="${inputCls}"/>`, "8 caractères minimum, avec au moins une lettre et un chiffre.")}
      <button class="${btn("secondary", "md", "w-full")}">Changer le mot de passe</button>
    </form>
    <button type="button" data-action="logout" class="${btn("dangerSoft", "md", "mt-3 w-full")}">${icon("logout")}Se déconnecter</button>`);
}

// ---------- Bandeau du site, bascule de thème ----------
function siteBanner() {
  const s = db.settings, parts = [];
  if (s.maintenance) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-center text-small font-medium text-warning-fg">${icon("alert", "size-4 shrink-0")}Le site est en maintenance : les connexions des clippers et des agences sont temporairement suspendues.</div>`);
  if (s.announcement) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-brand-line bg-brand-soft px-4 py-2 text-center text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}${esc(s.announcement)}</div>`);
  return parts.join("");
}
const themeToggle = (cls = "") =>
  `<button type="button" data-theme-toggle class="${iconBtn("md", false, cls)}" aria-label="Changer de thème (clair ou sombre)">
    <svg viewBox="0 0 24 24" class="dark:hidden" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg viewBox="0 0 24 24" class="hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>`;

// ---------- Graphiques (voir §6) ----------
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const seriesDates = (n, end = new Date()) => Array.from({ length: n }, (_, i) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1 - i)));
const dayLabel = (d) => `${d.getDate()}${NB}${MONTHS[d.getMonth()]}`;

// barChart(valeursJournalières, { tone: "income" | "brand", unit: "DA" | libellé singulier, unitPlural, integer, h, caption })
function barChart(values, { tone = "income", unit = "DA", unitPlural = "", integer = false, h = "h-44", caption = "" } = {}) {
  const n = values.length, peak = Math.max(0, ...values);
  const max = integer ? Math.max(1, Math.ceil(niceMax(peak))) : niceMax(peak);
  const dates = seriesDates(n), bar = tone === "income" ? "bg-chart-income" : "bg-chart-brand";
  const fv = (v) => (unit === "DA" ? da(v) : plural(v, unit, unitPlural || `${unit}s`));
  const ticks = integer && max < 4 ? [max, 0] : [max, max / 2, 0];
  return `<figure class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
    <div class="${h} flex flex-col justify-between text-right text-micro leading-none tabular-nums text-fg-subtle" aria-hidden="true">${ticks.map((t) => `<span>${compact(t)}</span>`).join("")}</div>
    <div class="relative ${h} border-b border-chart-axis bg-[linear-gradient(to_bottom,var(--color-chart-grid)_1px,transparent_1px)] bg-[size:100%_50%]" aria-hidden="true">
      <div class="absolute inset-0 flex items-end gap-[2px] px-0.5">${values.map((v, i) =>
        `<span class="flex h-full min-w-0 flex-1 items-end justify-center" title="${dayLabel(dates[i])} · ${fv(v)}">${v > 0 ? `<span class="w-full max-w-6 rounded-t-[3px] ${bar}" style="height:max(2px, ${((v / max) * 100).toFixed(2)}%)"></span>` : ""}</span>`).join("")}</div>
    </div>
    <span></span>
    <div class="mt-2 flex justify-between text-micro tabular-nums text-fg-subtle" aria-hidden="true"><span>${dayLabel(dates[0])}</span><span>${dayLabel(dates[Math.floor((n - 1) / 2)])}</span><span>Auj.</span></div>
    <table class="sr-only"><caption>${esc(caption)}</caption>${values.map((v, i) => (v ? `<tr><th>${dayLabel(dates[i])}</th><td>${fv(v)}</td></tr>` : "")).join("")}</table>
  </figure>`;
}

// cumulativeChart(valeursJournalières, { h, label, end, onNight }) : courbe verte du cumul (monotone, sans dépassement).
// end : affiche la valeur finale au-dessus du point. onNight : variante sur bg-night (panneau auth, CTA final).
function cumulativeChart(daily, { h = "h-24", label = "Gains cumulés", end = true, onNight = false } = {}) {
  let s = 0; const cum = (daily.length > 1 ? daily : [0, ...daily, 0].slice(0, 2)).map((v) => (s += v));
  const max = niceMax(Math.max(...cum, 1)), W = 300, H = 100, step = W / Math.max(1, cum.length - 1);
  const pts = cum.map((v, i) => [i * step, H - (v / max) * (H - 6)]);
  let d = `M ${pts[0][0]} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C ${m} ${y0.toFixed(2)}, ${m} ${y1.toFixed(2)}, ${x1} ${y1.toFixed(2)}`; }
  const [ex, ey] = pts.at(-1);
  const stroke = onNight ? "stroke-night-income" : "stroke-chart-income", fill = onNight ? "fill-night-income/15" : "fill-chart-income/12", dot = onNight ? "bg-night-income ring-night" : "bg-chart-income ring-surface";
  return `<div class="relative ${h}" role="img" aria-label="${esc(`${label} : ${da(s)} sur ${daily.length} jours`)}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <path d="${d} L ${W} ${H} L 0 ${H} Z" class="${fill}"/>
      <path d="${d}" class="fill-none ${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <span class="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ${dot}" style="left:${((ex / W) * 100).toFixed(2)}%;top:${((ey / H) * 100).toFixed(2)}%"></span>
    ${end && !onNight ? `<span class="absolute right-0 -translate-y-[calc(100%+8px)] text-small font-semibold tabular-nums text-fg" style="top:${((ey / H) * 100).toFixed(2)}%">${da(s)}</span>` : ""}
  </div>`;
}

// barList([{ label: HTML, value: nombre, display: texte }], { tone: "brand" | "income", aria })
function barList(items, { tone = "brand", aria = "" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value)), fill = tone === "income" ? "bg-chart-income" : "bg-chart-brand";
  return `<ul class="grid gap-4" aria-label="${esc(aria)}">${[...items].sort((a, b) => b.value - a.value).map((i) =>
    `<li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5"><span class="flex min-w-0 items-center gap-2 truncate text-sm text-fg">${i.label}</span><span class="text-sm font-medium tabular-nums ${i.value ? "text-fg" : "text-fg-subtle"}">${i.display}</span>
      <span class="col-span-2 block h-2 overflow-hidden rounded-full bg-muted">${i.value ? `<span class="block h-full rounded-full ${fill}" style="width:max(2px, ${((i.value / max) * 100).toFixed(1)}%)"></span>` : ""}</span></li>`).join("")}</ul>`;
}
// Ancien nom, ne plus appeler (le garde-fou l'interdit hors de ui.js).
const areaChart = (values) => cumulativeChart(values, { end: false });
```

### 4.3 Coquille `web/src/main.js` (lot A)

> **Code de référence du lot A, gardé pour l'historique.** La coquille actuelle est décrite au §4.8 et au §6.1 : barre latérale `w-[17rem]` en `flex-col` (bloc du bas toujours visible), bouton avatar et **menu du compte** à la place du nom et de la bascule de thème, tiroir sans bascule de thème, onglets mobiles du clipper Accueil / Découvrir / Clips / Portefeuille, brouillons et empilement des modales. En cas de doute, le code de `web/src/main.js` fait foi.

- **`AREAS`** : seul le champ `mobile` change (voir le commentaire de tête). Le reste du routeur et des écouteurs est inchangé, à l'exception des points marqués « À ajouter ».
- **Toasts :**
  - conteneur `#toasts` inchangé : `pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6` ;
  - ajouter `aria-live="polite"`.

```js
// ===================== web/src/main.js : coquille (remplace shellSidebar, shellTopbar, notifPanel, shellMobileNav, shell) =====================
// AREAS : seul « mobile » change (4 onglets + « Plus »).
//   clipper.mobile = ["accueil", "campagnes", "publications", "portefeuille"]   (libellés courts via n.short : « Clips »)
//   agence.mobile  = ["apercu", "campagnes", "clips", "budget"]
//   admin.mobile   = ["apercu", "utilisateurs", "campagnes", "moderation"]       (n.short : « Clips »)

const NAV_ITEM = `group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-control aria-[current=page]:ring-1 aria-[current=page]:ring-line ${FOCUS}`;
const NAV_ICON = "size-[18px] shrink-0 text-fg-subtle transition-colors group-hover:text-fg-muted group-aria-[current=page]:text-brand-fg";
// Mini-solde de la barre latérale : masqué là où le même chiffre est déjà le sujet de la page.
const MINI_HIDDEN = { clipper: ["accueil", "portefeuille"], agence: ["apercu", "budget"] };

function shellSidebar(area) {
  const nav = AREAS[area].nav(), u = userById(state.session), view = state.route.view;
  const mini = area !== "admin" && !MINI_HIDDEN[area].includes(view)
    ? `<a href="#/${area}/${area === "clipper" ? "portefeuille" : "budget"}" class="block rounded-tile border border-line bg-surface px-3 py-2.5 shadow-card transition-colors duration-150 hover:border-line-strong ${FOCUS}">
        <span class="block text-xs text-fg-subtle">${area === "clipper" ? "Solde disponible" : "Crédit disponible"}</span>
        <span class="mt-0.5 block text-[15px] font-semibold">${money(area === "clipper" ? balance() : u.credit)}</span></a>`
    : "";
  const cta = { clipper: ["submit-clip", "Soumettre un clip"], agence: ["ag-new", "Nouvelle campagne"] }[area];
  return `<div class="flex h-full flex-col">
    <div class="flex h-10 items-center gap-2 px-2">${logo({ size: "sm" })}${roleBadge(area)}</div>
    <p class="mt-6 px-2.5 text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle">${AREAS[area].title}</p>
    <nav class="mt-2 grid gap-0.5" aria-label="Navigation principale">${nav.map((n) => {
      const on = view === n.id, count = area === "admin" ? adminBadge(n.id) : 0;
      return `<a href="#/${area}/${n.id}" ${on ? 'aria-current="page"' : ""} class="${NAV_ITEM}">${icon(n.icon, NAV_ICON)}<span class="min-w-0 flex-1 truncate">${n.label}</span>${count ? countBadge(count, "queue") : ""}</a>`;
    }).join("")}</nav>
    <div class="mt-auto grid gap-3 pt-6">
      ${mini}
      ${cta ? `<button type="button" data-action="${cta[0]}" class="${btn("primary", "md", "w-full")}">${icon("plus")}${cta[1]}</button>` : ""}
      <a href="/" class="${btn("ghost", "sm", "w-full justify-start")}">${icon("globe")}Voir le site public</a>
      <div class="flex items-center gap-2.5 rounded-lg p-1.5">${avatar(u, "sm")}
        <div class="min-w-0 flex-1"><p class="truncate text-small font-medium text-fg">${esc(u.name)}</p><p class="truncate text-xs text-fg-subtle">${esc(u.email)}</p></div>
        <button type="button" data-action="logout" class="${iconBtn("sm", false, "hover:text-danger-fg")}" aria-label="Se déconnecter" title="Se déconnecter">${icon("logout")}</button>
      </div>
    </div></div>`;
}

function shellTopbar(area) {
  const u = userById(state.session), notifs = myNotifs(), unread = notifs.filter((n) => n.unread).length;
  const ctx = area === "clipper"
    ? searchInput("global-q", "", "Rechercher une campagne…", "Recherche rapide", "hidden w-full max-w-xs md:block")
    : `<p class="hidden min-w-0 truncate text-small text-fg-muted lg:block">${area === "admin" ? "Administration" : `Agence · ${esc(u.name)}`}</p>`;
  return `<header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
    <div class="flex items-center gap-2 lg:hidden">${logo({ size: "sm" })}${roleBadge(area)}</div>
    ${ctx}
    <div class="relative ml-auto flex items-center gap-1">
      <span class="hidden sm:contents">${themeToggle()}</span>
      <button type="button" data-action="notif" aria-expanded="${state.notifOpen}" aria-haspopup="dialog" aria-label="Notifications${unread ? ` (${unread} non lues)` : ""}" class="${iconBtn("md", false, "relative")}">${icon("bell")}${unread ? `<span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-canvas" aria-hidden="true"></span>` : ""}</button>
      ${state.notifOpen ? notifPanel(notifs) : ""}
      <a href="#/${area}/${AREAS[area].profile}" class="flex items-center gap-2 rounded-lg p-1 transition-colors duration-150 hover:bg-muted sm:pr-2 ${FOCUS}" aria-label="Mon compte">${avatar(u, "sm")}
        <span class="hidden text-left sm:block"><span class="block text-small font-medium leading-tight text-fg">${esc(u.name)}</span><span class="block text-xs text-fg-subtle">${area === "admin" ? "Administrateur" : area === "agence" ? "Agence" : esc(u.level)}</span></span></a>
    </div></header>`;
}

function notifPanel(list) {
  const anyUnread = list.some((n) => n.unread);
  return `<div class="absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface-raised shadow-popover animate-pop-in" role="dialog" aria-label="Notifications">
    <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><p class="text-sm font-semibold text-fg">Notifications</p>${anyUnread ? `<button type="button" data-action="read-all" class="${btn("link", "", "text-small")}">Tout marquer comme lu</button>` : ""}</div>
    ${list.length ? `<div class="max-h-96 divide-y divide-line overflow-y-auto">${list.map((n) => `<button type="button" data-action="read-one" data-id="${n.id}" class="relative flex w-full gap-3 px-4 py-3 pr-9 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${n.unread ? "bg-brand-soft/50" : ""}">
      ${eventIcon(n.icon)}<span class="min-w-0 flex-1"><span class="block text-small leading-5 ${n.unread ? "font-medium text-fg" : "text-fg-muted"}">${esc(n.text)}</span><span class="mt-0.5 block text-xs text-fg-subtle">${ago(n.at)}</span></span>
      ${n.unread ? '<span class="absolute right-4 top-4 size-2 rounded-full bg-brand"></span><span class="sr-only">(non lue)</span>' : ""}</button>`).join("")}</div>`
      : emptyState("bell", "Aucune notification", "Vous serez prévenu ici quand un clip est validé ou un paiement envoyé.", "", { inCard: true })}
  </div>`;
}

function shellMobileNav(area) {
  const ids = AREAS[area].mobile, nav = AREAS[area].nav(), inMore = !ids.includes(state.route.view);
  const TABI = "relative flex flex-col items-center justify-center gap-1 text-micro font-medium text-fg-subtle transition-colors [&_svg]:size-5 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full aria-[current=page]:text-brand-fg aria-[current=page]:before:bg-brand";
  return `<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Navigation mobile">
    <div class="grid h-16 grid-cols-5">
      ${ids.map((id) => { const n = nav.find((x) => x.id === id); return `<a href="#/${area}/${id}" ${state.route.view === id ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}">${icon(n.icon)}${n.short || n.label}</a>`; }).join("")}
      <button type="button" data-action="drawer" aria-expanded="${state.drawer}" ${inMore ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}">${icon("more")}Plus</button>
    </div></nav>`;
}

function shell(area) {
  const view = AREAS[area].views()[state.route.view]();
  return `<button type="button" data-action="skip" class="fixed left-4 top-3 z-[70] -translate-y-20 rounded-control bg-surface-raised px-4 py-2 text-sm font-medium text-fg shadow-popover transition-transform duration-150 focus:translate-y-0">Aller au contenu</button>
    ${siteBanner()}
    <div class="flex min-h-dvh bg-canvas">
      <aside class="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-line bg-canvas px-3 py-4 lg:block">${shellSidebar(area)}</aside>
      <div class="min-w-0 flex-1">
        ${shellTopbar(area)}
        <main id="main" tabindex="-1" class="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 outline-hidden sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">${view}</main>
      </div>
    </div>
    ${shellMobileNav(area)}
    ${state.drawer ? `<div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="absolute inset-0 bg-overlay animate-fade-in" data-action="drawer"></div>
      <aside class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-canvas px-3 py-4 shadow-modal animate-drawer-in">
        <div class="absolute right-3 top-4 z-10 flex items-center gap-1">${themeToggle()}<button type="button" data-action="drawer" class="${iconBtn("md")}" aria-label="Fermer le menu">${icon("close")}</button></div>
        ${shellSidebar(area)}</aside></div>` : ""}
    ${AREAS[area].modal()}`;
}

// ---------- Focus, récapitulatifs en direct, lien d'évitement (à intégrer dans render() et les écouteurs existants) ----------
let focusReturn = null; // sélecteur de l'élément qui a ouvert la modale ou le tiroir

// Dans render() : avant root.innerHTML = …
//   const hadOverlay = !!root.querySelector('[aria-modal="true"]');
// Après la restauration existante du focus des champs (focusKey) :
//   if (!focusKey) placeOverlayFocus(hadOverlay, active);
function placeOverlayFocus(hadOverlay, active) {
  const dlg = root.querySelector('[aria-modal="true"]');
  if (dlg && !hadOverlay) {
    const d = active && active.dataset ? active.dataset : {};
    focusReturn = d.action ? `[data-action="${d.action}"]${d.id ? `[data-id="${d.id}"]` : ""}` : null;
    const target = dlg.querySelector("[autofocus]") || (dlg.hasAttribute("tabindex") ? dlg : dlg.querySelector("button, a[href], input, select, textarea"));
    if (target) target.focus();
  } else if (!dlg && hadOverlay && focusReturn) {
    const el = root.querySelector(focusReturn);
    if (el) el.focus();
    focusReturn = null;
  }
}

// Tabulation bouclée dans la modale ou le tiroir ouvert.
function focusTrap(e) {
  if (e.key !== "Tab") return;
  const dlg = root.querySelector('[aria-modal="true"]');
  if (!dlg) return;
  const f = [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')].filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener("keydown", focusTrap);

// Récapitulatif en direct : LIVE[nom] renvoie une chaîne (pour [data-live-out=""]) ou un objet { clé: html } (pour [data-live-out="clé"]).
function runLive(form) {
  const fn = form && LIVE[form.dataset.live];
  if (!fn) return;
  const out = fn(Object.fromEntries(new FormData(form)));
  const parts = typeof out === "string" ? { "": out } : out;
  form.querySelectorAll("[data-live-out]").forEach((el) => { const k = el.dataset.liveOut; if (k in parts) el.innerHTML = parts[k]; });
}
// À ajouter en tête des écouteurs "input" ET "change" de root :
//   if (e.target.form && e.target.form.dataset.live) runLive(e.target.form);
// À ajouter dans le switch du clic :
//   case "skip": { const m = root.querySelector("#main"); if (m) m.focus(); return; }

// Écran d'erreur de démarrage (remplace le bloc avec ⚠️) :
//   root.innerHTML = `<div class="grid min-h-dvh place-items-center bg-canvas p-6">${emptyState("alert", esc(e.message), "Vérifiez votre connexion puis réessayez.", `<button type="button" onclick="location.reload()" class="${btn("primary")}">Réessayer</button>`)}</div>`;
```

### 4.4 Carte campagne (lot B ; variante agence lot C ; même structure en JSX pour F)

```js
// c : campagne ; joined, fav, mine (gains de l'utilisateur sur cette campagne) viennent des données existantes.
`<article class="group flex flex-col ${CARD} ${CARD_HOVER} p-2">
  <div class="relative">
    <button type="button" data-action="open-campaign" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="Voir la campagne ${esc(c.title)}">
      <span class="absolute inset-0 grid place-items-center text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">${c.emoji}</span>
      <span class="absolute left-2.5 top-2.5 inline-flex items-baseline gap-1 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(c.rate)}${NB}DA<span class="text-[11px] font-medium text-on-brand/80">/ 1k${NB}vues</span></span>
      ${c.top ? `<span class="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}Top campagne</span>` : ""}
    </button>
    <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" class="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-on-brand/90 text-night/70 shadow-control backdrop-blur-sm transition-colors hover:text-danger-solid aria-pressed:text-danger-solid ${FOCUS}">${icon("heart", "size-4", fav)}</button>
  </div>
  <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
    <div><p class="text-xs text-fg-subtle">${esc(c.brand)} · ${esc(c.category)}</p><h3 class="mt-0.5 font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3></div>
    <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-small">
      <dt class="text-fg-subtle">Payé dès</dt><dd class="text-right font-medium tabular-nums text-fg">${plural(viewsFor(c, c.minPayout), "vue", "vues")}</dd>
      <dt class="text-fg-subtle">Plafond par clip</dt><dd class="text-right font-medium tabular-nums text-fg">${da(c.maxPayout)}</dd>
      ${joined ? `<dt class="text-fg-subtle">Vos gains</dt><dd class="text-right font-medium">${money(mine, { signed: true })}</dd>` : ""}
    </dl>
    ${progress(c.spent, c.budget)}
    <div class="mt-auto pt-1">${joined ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("secondary", "sm", "w-full")}">${icon("plus")}Soumettre un clip</button>` : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("soft", "sm", "w-full")}">Rejoindre</button>`}</div>
  </div>
</article>`
```

- **Grille :** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`.
- **Couverture** en 16:9 (et non 4:3) : environ 30 % de hauteur gagnée sur mobile.
- La **date de création** passe dans le modal de détail.
- « Rejoindre » est en `soft` parce qu'il se répète dans une grille. Le seul `primary` de l'écran reste l'action globale.
- **Variante agence (C) :**
  - badge de statut sous le titre, aide de statut `text-xs text-fg-subtle` ;
  - `dl` Clippers / Clips / Vues (`compact`) ;
  - pied `grid grid-cols-2 gap-2` avec `btn("secondary", "sm")` « Mettre en pause » (icône `pause`) ou « Reprendre » (icône `play`), et `btn("ghost", "sm")` « Détails » ;
  - pas de bouton favori.
- `data-action` : garder les noms d'action existants de chaque fichier. Ceux ci-dessus sont indicatifs.

### 4.5 Tableau et liste (même conteneur)

```js
// Desktop (≥ md) : <table> ; mobile : <ul> de cartes compactes. Les deux sont rendus, chacun masqué selon l'écran.
`<div class="${TBL.wrap}">
  <table class="${TBL.table}">
    <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Clip</th><th scope="col" class="${TBL.th}">Plateforme</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Vues</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${amountLabel}</th><th scope="col" class="${TBL.th}">Statut</th>${actions ? `<th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">Décision</span></th>` : ""}</tr></thead>
    <tbody>${list.map((p) => `<tr class="${TBL.tr}">
      <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><a href="${esc(p.url)}" target="_blank" rel="noopener" class="block max-w-64 truncate font-medium text-fg hover:underline">${esc(p.title)}</a><span class="${TBL.tdSub} truncate">${esc(c.title)} · ${date(p.date)}</span></div></div></td>
      <td class="${TBL.td}">${platformTag(p.platform)}</td>
      <td class="${TBL.td} ${TBL.tdNum}">${fmt(p.views)}</td>
      <td class="${TBL.td} ${TBL.tdNum}">${money(earningsOf(p))}</td>
      <td class="${TBL.td}">${statusBadge(p.status)}</td>
      ${actions ? `<td class="${TBL.td} ${TBL.tdActions}">…</td>` : ""}</tr>`).join("")}</tbody>
  </table>
  <ul class="${TBL.list}">${list.map((p) => `<li class="${TBL.item}">
    <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(p.title)}</p><p class="truncate text-xs text-fg-subtle">${esc(c.title)} · ${date(p.date)}</p></div>${statusBadge(p.status)}</div>
    <div class="flex items-center justify-between text-small"><span class="text-fg-subtle">${plural(p.views, "vue", "vues")} · ${esc(p.platform)}</span><span class="font-medium">${money(earningsOf(p))}</span></div>
    ${actions ? `<div class="grid grid-cols-2 gap-2">… boutons md …</div>` : ""}</li>`).join("")}</ul>
</div>`
```

- Les noms de champs (`p.url`, `p.date`) sont indicatifs : garder ceux du code actuel.
- Une cellule vide vaut `—` en `text-fg-subtle`, jamais « 0 DA » pour un gain non encore calculé.
- Les en-têtes ont `scope="col"`.

### 4.6 Ligne d'historique d'argent (portefeuille, recharges, aperçus)

```js
const credit = t.amount > 0; // du point de vue de celui qui regarde
`<li class="flex items-center gap-3 py-3">
  <span class="grid size-8 shrink-0 place-items-center rounded-full ${credit ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon(credit ? "arrowDownLeft" : "arrowUpRight", "size-4")}</span>
  <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(t.label)}</p><p class="truncate text-xs text-fg-subtle">${date(t.date)} · ${code(t.ref)}${t.fee ? ` · frais ${da(t.fee)}` : ""}</p></div>
  <div class="shrink-0 text-right"><p class="text-sm font-medium">${money(t.amount, { signed: true })}</p><div class="mt-1 hidden justify-end sm:flex">${statusBadge(t.status)}</div></div>
</li>`
```

- **Liste :** `<ul class="divide-y divide-line">`.
- **Regroupement par mois** (greffe de « Creator-economy energy ») : un intertitre `<li class="pb-1 pt-4 text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle first:pt-0">Octobre 2026</li>` avant chaque mois.
- Sur mobile, le statut passe sous le libellé si la transaction n'est pas « Validé » (en attente ou refusée), sinon il est omis.

### 4.7 Modales d'argent (retrait, ajout de budget, recharge)

Règles :
- unité en suffixe (`unitInput`) ;
- raccourci de montant (« Tout retirer ») ;
- choix en cartes (`CHOICE`) avec les frais à droite ;
- récapitulatif (`summary`) mis à jour en direct (`live`) ;
- **montant répété sur le bouton de confirmation**.

```js
// clipper.js (lot B) : enregistrement du récapitulatif en direct, au niveau supérieur du fichier.
LIVE.withdraw = (d) => {
  const a = Math.max(0, Math.round(+String(d.amount || "").replace(/\D/g, "")) || 0), s = db.settings;
  const fee = d.speed === "instant" ? Math.max(s.instantMinFee, Math.round((a * s.instantFeePercent) / 100)) : 0;
  return {
    "": summary([["Montant demandé", money(a)], ["Frais", fee ? money(fee) : "Aucun"], ["Vous recevrez", money(Math.max(0, a - fee)), true]]),
    btn: a ? `Confirmer le retrait de ${da(a)}` : "Confirmer le retrait",
  };
};

// Ouverture : body et footer ; le calcul initial réutilise LIVE.withdraw.
const init = LIVE.withdraw({ amount: balance(), speed: "standard" });
modalShell({
  title: "Demander un retrait", description: `Solde disponible : ${da(balance())}`, form: "withdraw", live: "withdraw",
  body: `<div class="grid gap-5">
    ${field("Montant", `<div class="flex gap-2"><div class="min-w-0 flex-1">${unitInput(`name="amount" value="${balance()}" autocomplete="off" autofocus`, "DA", { lg: true })}</div><button type="button" data-action="wd-max" class="${btn("secondary", "lg")}">Tout retirer</button></div>`, `Minimum ${da(db.settings.minWithdraw)}`)}
    <fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">Délai</legend>
      <label class="${CHOICE}"><input type="radio" name="speed" value="standard" class="${RADIO}" checked/><span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">Standard</span><span class="block text-xs text-fg-subtle">Sous 3 jours ouvrés</span></span><span class="text-sm font-medium tabular-nums text-fg">Gratuit</span></label>
      <label class="${CHOICE}"><input type="radio" name="speed" value="instant" class="${RADIO}"/><span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">Instantané</span><span class="block text-xs text-fg-subtle">${db.settings.instantFeePercent}${NB}% de frais, minimum ${da(db.settings.instantMinFee)}</span></span>${icon("clock", "mt-0.5 size-4 text-fg-subtle")}</label>
    </fieldset>
    <div data-live-out>${init[""]}</div>
    <p class="flex items-center gap-2 text-small text-fg-muted">${icon("bank", "size-4 shrink-0 text-fg-subtle")}Vers ${esc(methodLabel)} ${maskAccount(account)}</p></div>`,
  footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button><button class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
});
// handleClipperAction : case "wd-max" → const i = root.querySelector('[name="amount"]'); i.value = balance(); i.dispatchEvent(new Event("input", { bubbles: true }));
```

- **État bloquant** (pas de moyen de retrait, solde sous le minimum) : `alertBox("info", …)` avec un lien vers Paramètres, et le bouton de confirmation `disabled`.
- **Erreur serveur :** `field(…, …, "", message)` et `aria-invalid="true"`, ou `alertBox("danger", …)` au-dessus du pied.
- **Ajouter du budget (C) :** `LIVE.budget` calcule « 50 000 DA + commission 15 % = 57 500 DA débités » (`withCommission`), avec `alertBox("warning")` si le crédit est insuffisant.
- **Recharger (C) :** 3 `CHOICE` (Virement bancaire, Edahabia, CIB) et un toast qui montre la référence.

### 4.8 Menu du compte, photos, badge vérifié, thème et langue, modales (brouillons, empilement)

Pièces partagées ajoutées avec le lot « 16 demandes » (octobre 2026). Les noms ci-dessous sont réservés à leur fichier (§0.2).

**Menu du compte (`main.js` : `accountMenu`, `state.menuOpen`, panneau `#account-menu`)**
- La barre du haut ne porte plus, à droite, que la cloche et **le bouton avatar** (`data-action="account-menu"`, `aria-haspopup="dialog"`, `aria-expanded`, `title` = nom complet) : photo de profil, sinon **2 initiales** (`initials()` de `ui.js` : premières lettres des deux premiers mots, ou deux premières lettres d'un nom en un seul mot ; ponctuation ignorée). Plus de nom en clair, plus de bascule de thème.
- Panneau `absolute end-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-card bg-surface-raised shadow-popover animate-pop-in`, hauteur bornée (`max-h-[calc(100dvh-8.5rem)]`, `lg:max-h-[calc(100dvh-4.5rem)]`) : il ne passe jamais sous la navigation mobile. Contenu, dans l'ordre :
  1. en-tête : `avatar(u, "md")`, nom entier (`nameWithBadge(u)`, `break-words`), email (`break-all`, `dir="ltr"`), rôle en `badge()` (clipper : son niveau, icône `medal` ; agence : `info` + `building` ; admin : `brand` + `shield`) ;
  2. « Mon profil » (`#/clipper/profil`, `#/agence/profil`) ou « Mon compte » (`#/admin/compte`) ;
  3. « Paramètres » (`#/clipper/parametres`, `#/agence/parametres`) ou « Réglages du site » (`#/admin/parametres`) ;
  4. ligne « Langue » + `langSwitch()` (FR / EN / ع) ;
  5. « Mentions légales », « Aide et support » (`data-action="soon"` → toast `info` « Bientôt disponible », pages à créer) ;
  6. « Se déconnecter » (`text-danger-fg hover:bg-danger-bg`) ;
  7. pied `bg-subtle` : « Thème » + `themeModeSwitch()` (soleil, lune, écran : clair, sombre, système).
- Lignes : `MENU_ITEM` (`h-10 rounded-lg px-2.5`, icône 18 px `text-fg-subtle`, `aria-current="page"` sur la page affichée), anneau de focus **intérieur** (`FOCUS_INSET`).
- Comportement identique au panneau des notifications, et les deux sont **exclusifs** : focus sur la première action à l'ouverture, retour au bouton à la fermeture ; fermeture par un clic à l'extérieur (l'action cliquée s'exécute quand même), Échap, un changement de page ou un lien du menu ; la langue et le thème le laissent ouvert (le bouton de langue garde le focus après le réaffichage). Un panneau ouvert fait passer la barre du haut en `z-40`.

**Barre latérale et tiroir (`main.js` : `shellSidebar`)**
- `w-[17rem]` (au lieu de `w-60`) ; conteneur `sticky top-0 h-dvh flex flex-col overflow-y-auto`. Trois blocs : logo (`shrink-0`), navigation (`min-h-32 flex-1 overflow-y-auto`, seule partie qui défile, `-mx-3 px-3` pour ne pas rogner l'anneau de focus), bloc du bas `shrink-0` **toujours visible** sans faire défiler la page.
- Bloc du compte : nom (`nameWithBadge(u, "size-3.5")`, `break-words`) et email (`break-all`) **renvoyés à la ligne**, jamais tronqués.
- Clipper : plus de mini-solde ni de « Soumettre un clip ». Agence : crédit disponible (masqué sur Accueil et Budget, `MINI_HIDDEN`) et « Nouvelle campagne ». Admin : rien.
- Les bandeaux du site (`siteBanner()`) sont dans la colonne du contenu, au-dessus de la barre du haut : la barre latérale garde toute la hauteur.
- Tiroir mobile : `w-80 max-w-[85vw]`, `start-0` (à droite en arabe, animation `drawer-in-rtl` de `web/styles.css`), marges de zone sûre ; un seul outil, le bouton Fermer.

**Photos (`ui.js` : `imageField`, `readImage`, `setImageField`, `avatar`, `coverThumb`, `coverArt`)**
- `imageField({ name, value, shape, label, hint, fallback })` : aperçu, « Choisir une photo » / « Changer la photo » (input fichier `sr-only` dans un `btn("secondary", "sm")`), « Retirer », et un `<input type="hidden" name>` qui porte la valeur envoyée à l'API : data URL (nouvelle photo), adresse actuelle (inchangée) ou `""` (retirée).
- Formes : `avatar` (rond, 320 px), `cover` (bandeau 3:1, 1 500 px), `campaign` (16:9, 1 280 px). L'image est recadrée au centre et compressée en JPEG dans le navigateur (`readImage`, ≤ 2 Mo de data URL) ; JPEG, PNG ou WebP de 15 Mo au plus.
- `setImageField(champ, valeur)` met à jour l'aperçu et déclenche `input` sur le champ caché (récapitulatifs, brouillons).
- Affichage : `avatar(u, size)` et `coverThumb(c)` / `coverArt(c)` montrent la photo si elle existe, sinon initiales ou couverture en dégradé (`.cover:has(> img)` retire le filtre sombre). Couverture d'agence : `<img class="size-full object-cover">` dans un cadre 3:1, dégradé en repli.

**Badge vérifié (`ui.js` : `verifiedBadge(cls, label)`, `nameWithBadge(u, cls)`)**
- Sceau bleu Meta (`text-verified`, `--color-verified: #1d9bf0`) avec coche blanche, `role="img"` et libellé « Agence vérifiée ». Couleur fixe, identique en clair et en sombre.
- `nameWithBadge(u)` = nom échappé + espace insécable + badge si `u.verified`. À utiliser partout où le nom d'une agence s'affiche (barre latérale, menu du compte, barre du haut de l'agence, cartes et fiches).

**Thème et langue (`ui.js` : `themeModeSwitch({ labels, cls })`, `langSwitch({ full, cls })`)**
- Contrôles segmentés (`SEG_WRAP`, `SEG_BTN`, `aria-pressed`). Thème : boutons `[data-theme-set="light|dark|system"]` gérés par `web/theme.js` (qui met aussi à jour `aria-pressed` et la couleur de la barre du navigateur, `meta theme-color`). Langue : `[data-lang-set="fr|en|ar"]` gérés par `web/src/i18n.js` (`setLang` : mémorisé dans le navigateur et sur le compte, puis réaffichage).
- `SEG_BTN` et `chips()` ont un anneau de focus intérieur (`FOCUS_INSET`) : leur cadre `overflow-x-auto` rognait l'anneau extérieur.
- Arabe : `html[dir="rtl"]`, police arabe du système en repli (`html:lang(ar)` dans `web/styles.css`). L'accueil public de la version autonome reste en français, de gauche à droite (`applyLangAttrs()` respecte `html[data-view="landing"]`, `web/offline/landing.js` force `lang="fr" dir="ltr"`, le script de tête de `web/index.html` n'applique la langue qu'aux routes `#/…` et à `/espace`). Graphiques en `dir="ltr"`.

**Carte « Compte et connexion » (`ui.js` : `accountCard(u)`, `handlePasswordSubmit`)**
- Email (`break-all`) + `badge("Vérifiée", "success")` si `u.emailVerified` ; ligne « Connexion avec Google / Apple / Discord activée » si `u.providers` n'est pas vide.
- Mot de passe : avec `u.hasPassword`, « Mot de passe actuel » + « Nouveau mot de passe » ; sans (compte créé avec Google, Apple ou Discord), « Définir un mot de passe » : le nouveau seul, avec une phrase d'explication ; l'API reçoit `{ current: "", next }`, puis les données sont rechargées. L'erreur du serveur est posée sur le bon champ (`aria-invalid`).

**État de l'interface (`state`, `main.js`)**
- `menuOpen` (menu du compte), `notifOpen`, `drawer` : une seule couche ouverte à la fois ; tout changement de page les referme, ainsi que la modale.
- `modal` : `{ type, id?, …, draft?, back? }` (voir ci-dessous).
- `camp` : Découvrir et Agences du clipper, `{ aq, q, category, sort, scope: "Toutes" | "Rejointes" | "Favoris", layout }` (plus de `tab` ni de `favOnly`).
- `clChart` (`"jour"` | `"cumul"`) et `clClips` (`"recent"` | `"top"`) : graphique et tableau de clips de l'Accueil du clipper.

**Modales : brouillons, champs conditionnels, empilement (`main.js`)**
- **Brouillon** : chaque saisie dans un formulaire de modale (`form[data-form]` dans `[aria-modal="true"]`, ou qui l'est lui-même) est copiée dans `state.modal.draft = { nom: valeur }` par `captureDraft(form)` (écouteurs `input` / `change` sur `window`, donc après ceux des espaces). Case à cocher → booléen (plusieurs cases du même nom → tableau des valeurs cochées), radio → valeur choisie, autres → `.value`. Ignorés : `type=file`, `type=password`, `[data-nodraft]` (champs de carte bancaire, `autocomplete="cc-number|cc-exp|cc-csc|cc-name"`), champs cachés sauf celui d'un `imageField`.
- **Restauration** : après chaque `render()` qui affiche la même modale (même objet, ou nouvel objet de même `type` et même `id`), `restoreDraft()` remet la saisie (photo : `setImageField`), puis `runLive(form)`. Un rechargement des données, un champ conditionnel, une erreur du serveur ou le retour d'une modale empilée ne perdent jamais la saisie. Repartir d'un formulaire vierge : `state.modal = { type, id, draft: {} }`. Imposer une valeur : l'écrire dans le champ et déclencher `input`.
- **Champ conditionnel** : un contrôle `[data-rerender]` (ou dans un conteneur `[data-rerender]`) d'un formulaire de modale capture le brouillon puis réaffiche la modale à chaque `change` ; le rendu lit `state.modal.draft` (catégorie « Autre » → « Précisez la catégorie », « Toutes les plateformes » / « Une seule »). Le focus revient sur le même contrôle (`fieldKey`).
- **Modale empilée** : `openStacked({ type, … })` ouvre une modale par-dessus la courante (`state.modal.back`) et réaffiche. ✕, « Annuler » (`close-modal`) et Échap ramènent à la modale d'en dessous avec sa saisie ; après une action réussie, `closeStacked()` dans le `after` d'`act()` (réaffiche, sans effet de bord avec le réaffichage d'`act()`). Le focus revient sur le bouton qui l'avait ouverte, sinon sur le premier champ. Cas d'usage : « Recharger le crédit » depuis le formulaire de campagne.
- **Fond sombre** : un clic ferme la modale seulement si l'appui a commencé sur le fond (une sélection de texte commencée dans la boîte ne ferme rien) **et** si rien n'a été saisi (`state.modal.draft`) ; sinon seuls ✕, « Annuler » et Échap la ferment.
- **Échap** ferme la couche du dessus : modale empilée → modale d'en dessous → plus de modale ; sinon le panneau ouvert (notifications, menu du compte) ; sinon le tiroir.
- **Case indéterminée** : une case à cocher rendue avec `data-indeterminate` (case maîtresse « Toutes les plateformes » quand certaines seulement sont cochées) reçoit `indeterminate = true` après chaque `render()` (l'état n'existe pas en HTML) ; le gestionnaire `change` de l'espace le tient à jour ensuite.
- **Formulaires de page** (Profil, Paramètres, Réglages du site… : `form[data-form]` hors modale dans un espace) : même brouillon, gardé par page dans `pageDrafts[nom]` et remis en place après chaque `render()` de la même page (`restorePageDrafts`). Ouvrir les notifications ou le menu du compte, changer de langue, ou une action qui recharge les données (un interrupteur des Réglages) ne vide donc plus un formulaire en cours, photo choisie comprise. Un formulaire envoyé abandonne son brouillon au rechargement suivant des données (enregistrement réussi : valeurs du serveur) ; une nouvelle saisie le reprend ; changer de page les abandonne tous. Remise à zéro volontaire : `dropPageDraft(nom)` puis `render()`. Les écrans de connexion gardent leur propre mécanisme (`auth.js`).

**Routes (`main.js`)**
- `ROUTE_ALIASES` : `#/clipper/campagnes[/<id>]` → Découvrir, `#/clipper/statistiques` → Accueil ; une ancienne adresse ou une page inconnue est remplacée par celle de la page affichée (`history.replaceState`).
- `ITEM_PAGES` : `clipper/agence` (navigation : Agences), `admin/utilisateur` (navigation : Utilisateurs).
- `applyRouteItem` : `#/clipper/decouvrir/<id>` → fiche `campaign` ; `#/agence/campagnes/<id>` → `ag-open` ; `#/admin/campagnes/<id>` → fiche d'examen `adm-camp` ; `#/admin/moderation/<id>` → fiche `adm-clip` (liste filtrée sur le statut du clip) ; `#/admin/retraits/<id>` → onglet et ligne ; les autres pages mettent la ligne `[data-row]` en évidence. Les filtres de la page sont remis à zéro d'abord (Découvrir : recherche, catégorie et `scope: "Toutes"`). Un élément qui n'existe plus (campagne annulée ou supprimée par son agence, notification ancienne) : la page seule, sans fiche ni erreur.
- Recherche rapide du clipper (barre du haut, ≥ md) : Entrée → `#/clipper/decouvrir` avec la recherche (catégorie « Toutes », `scope: "Toutes"`) ; absente de Découvrir, qui a son propre champ.
- `NOTIF_DEST` : libellé de destination d'une notification selon la page de son lien (« Voir la campagne », « Voir le clip », « Voir le profil », « Voir l'opération », « Voir la demande », « Voir le budget », « Ouvrir mon espace »).
- Titre de l'onglet (`pageTitle`) : « Découvrir · Espace Clipper — ClipBoost » (entrée de navigation courante, page d'élément comprise), « Mon compte · Administration — ClipBoost ».
- Le menu du compte ne montre que les pages qui existent dans l'espace (`AREAS[area].views()`).
- Crochets facultatifs pour les espaces : `handleAuthAction(action, el)` (clic `data-action` inconnu sur les écrans de connexion), `handleClipperInput` / `handleAgencyInput` / `handleAdminInput(clé, champ, événement)` (champ `data-input` inconnu de la coquille) ; un formulaire des écrans de connexion est toujours passé à `handleAuthSubmit`.

---

## 5. Visualisation de données

### 5.1 La forme suit la nature de la donnée

| Donnée | Forme | Couleur | Écrans |
|---|---|---|---|
| Flux quotidien (gains du jour, budget consommé du jour, inscriptions) | **Barres verticales** (`barChart`), une par jour. Un jour à 0 n'a pas de barre. | `chart-income` (argent qui entre chez celui qui regarde), `chart-brand` (volume ou dépense) | Clipper Accueil et Statistiques (Par jour), Agence Aperçu, Admin Vue d'ensemble |
| Stock cumulé (revenus cumulés) | **Ligne cumulée** (`cumulativeChart`) : 2 px, aire à 12 %, point final, valeur finale | `chart-income` | Carte portefeuille de l'Accueil (bord à bord), Statistiques (Cumulé), héros du landing, panneau auth (`onNight`, sans chiffres) |
| Une valeur par catégorie (vues par plateforme, gains par campagne) | **Barres horizontales triées** (`barList`), **une seule teinte** | `chart-brand` (vues), `chart-income` (gains) | Statistiques, maquette Gains du landing |
| Part d'un tout dans le temps (futur) | Barres empilées, 2 px d'écart couleur surface, `chart-1` à `chart-4`, légende obligatoire, au-delà de 4 regrouper en « Autres » | catégorielle | — |
| Un seul chiffre | **Pas de graphique** : KPI ou solde héros | — | partout |

### 5.2 Palette (validée par le script)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `chart-1` | `#7c3aed` | `#8b5cf6` | Série 1 |
| `chart-2` | `#0284c7` | `#0891b2` | Série 2 |
| `chart-3` | `#d97706` | `#d97706` | Série 3 |
| `chart-4` | `#db2777` | `#e0457b` | Série 4 |
| `chart-income` | `#0f766e` | `#2dd4bf` | Série unique « revenus » |
| `chart-brand` | `#7c3aed` | `#8b5cf6` | Série unique volume ou dépense |
| `chart-grid` / `chart-axis` | `#eceef2` / `#cdd2da` | `#1c212a` / `#353c4a` | Grille 1 px pleine, ligne de base |
| `night-income` | `#5eead4` | idem | Courbe sur `bg-night` (12,5:1) |

Résultats de `validate_palette.js` :
- **clair** (sur `#ffffff`) : pire paire voisine en daltonisme ΔE 9,2, vision normale ΔE 19,8 ;
- **sombre** (sur `#12151c`) : tout passe.

`#0f766e` a un chroma sous le seuil catégoriel : c'est voulu, il ne sert qu'en série unique. Les couleurs sont assignées dans l'ordre fixe 1, 2, 3, 4 et suivent l'entité : un filtre ne repeint jamais les séries restantes.

### 5.3 Règles de lecture

- **En-tête de chaque graphique :**
  - `h2` `text-section` ;
  - total de la période en `bigMoney(n)` ;
  - contexte `text-small text-fg-subtle` (« sur 30 jours · 3 jours actifs ») ;
  - `segmented` 7 j / 30 j à droite.
- **Axe Y :**
  - 3 graduations (0, moitié, maximum arrondi par `niceMax`), en `compact`, `text-micro tabular-nums text-fg-subtle` ;
  - comptages en graduations entières (`integer: true`) : sous 4, seulement 0 et le maximum.
- **Axe X :** 3 dates (première, milieu, « Auj. »).
- **Grille :**
  - lignes pleines 1 px, horizontales seulement ;
  - jamais de pointillés ni de grille verticale ;
  - pas de grille dans les mini-courbes (carte portefeuille, héros, auth).
- **Barres :**
  - au plus 24 px de large (`max-w-6`) ;
  - haut arrondi 3 px, base carrée, 2 px d'écart ;
  - au moins 2 px de hauteur pour une valeur non nulle.
- **Ligne :**
  - 2 px en `vector-effect="non-scaling-stroke"` ;
  - point final en HTML (`size-2.5 rounded-full ring-2 ring-surface`) : un cercle SVG serait déformé par `preserveAspectRatio="none"`.
- **Libellés sélectifs :** seulement la valeur finale de la ligne cumulée. Jamais un nombre sur chaque barre. Le texte est dans les couleurs de texte, jamais dans celle de la série.
- **Ne jamais interpoler une série quotidienne.** La courbe lissée n'est permise que sur le cumul, qui est monotone : la construction cubique à tangentes horizontales ne dépasse pas.
- **Accessibilité :**
  - `title` natif sur chaque barre (« 10 oct. · 7 230 DA ») ;
  - `<table class="sr-only">` des valeurs non nulles avec `caption` ;
  - SVG en `aria-hidden` ;
  - `role="img"` et `aria-label` (total) sur la ligne cumulée ;
  - l'identité n'est jamais portée par la couleur seule : une série unique est nommée par le titre, et à partir de 2 séries une légende est obligatoire.
- **Légende** (à partir de 2 séries) : `<ul class="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted"><li class="flex items-center gap-1.5"><span class="size-2 rounded-[2px] bg-chart-1"></span>TikTok</li>…</ul>`.

---

## 6. Coquille de l'app et chaque écran

### 6.1 Coquille commune (lot A, code au §4.3)

- **Une coquille pour les 3 rôles**, sur `bg-canvas`. L'admin se reconnaît au `roleBadge("admin")` à côté du logo et à l'intitulé « Administration ». La barre latérale encre disparaît.
- **Racine :** `flex min-h-dvh bg-canvas`.
- **Barre latérale :** `sticky top-0 h-dvh w-[17rem] flex flex-col` (détail au §4.8 : seule la navigation défile, le bloc du bas reste visible, nom et email renvoyés à la ligne). Elle contient :
  - logo et tag ;
  - intitulé `text-micro uppercase` ;
  - navigation `NAV_ITEM` (état via `aria-current="page"`, icône active en `text-brand-fg`) ;
  - compteurs admin en `countBadge(n, "queue")`, violet doux et **jamais rouge** ;
  - en bas, dans l'ordre :
    1. agence seulement : crédit disponible (lien vers Budget, masqué selon `MINI_HIDDEN`) et action globale `primary` « Nouvelle campagne » (le clipper n'a plus ni mini-solde ni « Soumettre un clip » ; l'admin, rien) ;
    2. « Voir le site public » ;
    3. ligne compte avec déconnexion.
- **Action principale dans l'en-tête de page :** seulement sous `lg` (`<span class="lg:hidden">${btn(…)}</span>`). On n'a jamais deux fois le même bouton à l'écran.
- **Barre du haut `h-14` :**
  - sous `lg` : logo `sm` + tag ;
  - clipper : recherche à partir de `md` (absente de Découvrir) ;
  - agence : « Agence · Nom » (avec badge vérifié) ; admin : « Administration » ;
  - à droite : notifications (point violet si non lu, nombre dans l'`aria-label`) et bouton avatar qui ouvre le **menu du compte** (§4.8 : profil, paramètres, langue, mentions légales, aide, déconnexion, thème). Plus de bascule de thème dans la barre.
  - **Pas de hamburger.**
- **Navigation mobile :** 4 onglets plus « Plus », qui ouvre le tiroir. Libellés courts :
  - Clipper : Accueil, Découvrir, Clips, Portefeuille ;
  - Agence : Accueil, Campagnes, Clips, Budget ;
  - Admin : Aperçu, Utilisateurs, Campagnes, Clips.
  - « Plus » porte `aria-current="page"` quand la vue courante n'est pas dans les 4.
- **Tiroir :** même contenu que la barre latérale, plus un bouton Fermer (le thème est dans le menu du compte), `animate-drawer-in` (par la droite en arabe).
- **Notifications :**
  - panneau `rounded-card bg-surface-raised shadow-popover animate-pop-in` ;
  - pictogramme `eventIcon(n.icon)` (l'emoji du serveur devient une icône au trait dans une pastille teintée) ;
  - non lu : `bg-brand-soft/50`, texte `font-medium` et point violet ;
  - état vide si la liste est vide ;
  - « Tout marquer comme lu » affiché seulement s'il reste du non-lu ;
  - avec un lien (`n.link`, route `#/<espace>/<page>/<id>` posée par le serveur, voir `lib/server/links.ts`) : sous l'heure, la destination (« Voir le clip ») et `chevronRight` ; le clic ferme le panneau, marque la notification lue et ouvre la page. `applyRouteItem()` (`main.js`) remet les filtres à zéro, puis ouvre la fiche (campagne) ou met en évidence la ligne `[data-row="<id>"]` visible (`flashRow()` : centrée, focus, classe `row-flash` de `web/styles.css`, teinte fixe en mouvement réduit). L'adresse redevient `#/<espace>/<page>` ; déjà sur cette page, l'entrée d'historique est remplacée (pas de doublon pour Retour). Une notification enregistrée avant les liens reçoit un lien déduit de son texte (`inferLink()`, même fichier, appelé par `stateFor`). Une campagne en pause ou terminée ouverte ainsi par un clipper affiche son statut, sans « Rejoindre » ni « Soumettre un clip ».
- **Accessibilité :**
  - bouton d'évitement « Aller au contenu » (`data-action="skip"`) ;
  - `main#main tabindex="-1"` ;
  - focus envoyé dans la modale ou le tiroir à l'ouverture, puis rendu à l'élément d'origine à la fermeture ;
  - tabulation bouclée ;
  - Échap ferme la couche du dessus (modale empilée, modale, panneau, tiroir).
- **Bandeaux du site** (`siteBanner()`) : maintenance en `warning` avec icône `alert`, annonce en `brand-soft` avec icône `megaphone`. Plus de bandeau rose plein ni d'emoji.

### 6.2 Espace Clipper (lot B, `web/src/clipper.js`)

**Navigation (`CLIPPER_NAV`)** : Accueil (`home`) · Découvrir (`compass`) · Agences (`building`) · Mes publications, court « Clips » (`film`) · Portefeuille (`wallet`) · Profil (`user`) · Paramètres (`gear`). Onglets mobiles : Accueil, Découvrir, Clips, Portefeuille (+ « Plus »). La page Statistiques n'existe plus : son contenu est une section de l'Accueil, et `#/clipper/statistiques` (comme `#/clipper/campagnes[/<id>]`, devenu Découvrir) est redirigé par `ROUTE_ALIASES` (§4.8). La barre latérale du clipper n'a plus ni solde ni « Soumettre un clip » : l'action vit dans l'en-tête de l'Accueil et de Mes publications, et sur chaque campagne rejointe.

**Accueil (`cAccueil`)** : aperçu et statistiques réunis, sans rien afficher deux fois.
1. **`pageHeader`** :
   - titre « Bonjour Yacine », sans 👋 ;
   - sous-titre « Voici votre activité au 12 oct. 2026 » ;
   - action `btn("primary")` « Soumettre un clip », visible à toutes les tailles (la barre latérale ne la porte plus).
2. **Onboarding** (aucune campagne rejointe) : carte `border-brand-line bg-brand-soft` avec 3 étapes numérotées en ligne (`grid size-6 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand`) et `btn("primary")` « Voir les campagnes ».
3. **Rangée 1** `grid gap-4 lg:grid-cols-[1.35fr_1fr]` :
   - **Carte portefeuille** `card(…, "p-5 overflow-hidden")`, seule source du solde sur cet écran. Elle remplace la tuile « Gains totaux », la carte « Revenus » et le mini-solde latéral :
     - « Solde disponible » `text-small font-medium text-fg-muted` ;
     - `bigMoney(balance(), "money")` ;
     - actions `btn("primary")` « Retirer » et `btn("ghost")` « Portefeuille » (lien) ;
     - `dl grid grid-cols-2 gap-4 border-t border-line pt-4 mt-5` :
       - « En rétention » `money(pendingAmount())` en `text-fg`, avec `icon("clock")` et l'aide `text-xs text-fg-subtle` « libéré après 3 jours de contrôle » ;
       - « Total gagné » `money(totalEarned())` ;
     - **courbe cumulée bord à bord** en bas de carte : `<div class="-mx-5 -mb-5 mt-5 pr-4">${cumulativeChart(dailySeries(), { h: "h-20", end: false })}</div>`. C'est l'identité DROPP ; le `pr-4` garde le point final entier.
   - **Dernières opérations** : `card` avec `cardHeader("Dernières opérations", "", lien « Tout voir » vers le portefeuille)` et 4 lignes d'historique (§4.6).
4. **Motivation** (greffe de « Creator-economy energy ») :
   - si une publication en attente est sous le seuil (`belowMin`), afficher la plus proche dans un `alertBox("info", …)` : « Plus que **400 vues** sur « Derby Algérois » pour être payé. » ;
   - calcul : `viewsFor(c, c.minPayout) − p.views` ;
   - une seule à la fois, jamais d'emoji.
5. **KPI** `grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4` :
   - Gains de la période (delta contre la période précédente, `DELTA`) ;
   - Vues totales (`compact`) ;
   - Clips publiés (sous-ligne « 3 validés · 1 en attente ») ;
   - Taux de validation (`pct`).
   - Toutes les tuiles sont **neutres**, sans fond teinté.
6. **« Gains par jour »** : `barChart(dailySeries(), { tone: "income", caption: "Gains par jour" })`, `segmented("period", …)` 7 j / 30 j, total et jours actifs dans l'en-tête.
7. Section « Statistiques » (dès le premier clip, voir plus bas), puis « Vos clips » : un seul tableau, « Récents » ou « Les plus vus » (`state.clClips`), puis `sectionHeader("À découvrir", "#/clipper/decouvrir")` avec 3 campagnes actives pas encore rejointes.

**Découvrir (`cDecouvrir`, `#/clipper/decouvrir`, ancienne page Campagnes)**
- **Barre d'outils desktop sur une ligne :**
  - `searchInput("camp-q", …, "flex-1 max-w-sm")` ;
  - `select` catégorie ;
  - `select` tri ;
  - portée Toutes / Rejointes / Favoris (`state.camp.scope`) : `segmented` avec compteurs à partir de `md`, deux puces sous `md` (une puce active touchée de nouveau revient à « Toutes ») ; Rejointes et Favoris montrent aussi les campagnes en pause ou terminées, après les actives ;
  - `segmented` grille / liste (icônes `grid` / `list`, `aria-label`).
- **Mobile :** recherche pleine largeur, puis une rangée `chips` défilante (catégories). Le tri et la mise en page passent dans un `select` compact. **Au plus 2 rangées avant la première carte.**
- « 3 résultats » `text-small text-fg-subtle` au-dessus de la grille.
- **Grille :** cartes §4.4.
- **Vue liste :** tableau §4.5 (vignette, campagne, marque · catégorie, tarif `tdNum`, clippers `tdNum`, favori, action `sm`).
- **État vide :** `emptyState("search", "Aucune campagne ne correspond", "Essayez une autre catégorie ou effacez la recherche.", btn("secondary") « Effacer les filtres »)`.
- **Modal de détail** `modalShell({ title: c.title, description: "Marque · Catégorie · créée le …", size: "lg" })` :
  - couverture `cover aspect-[16/9] rounded-tile` ;
  - tuiles `grid grid-cols-2 gap-2 sm:grid-cols-3` en `TILE` (libellé `text-xs text-fg-subtle`, valeur `text-sm font-semibold tabular-nums text-fg`) : Tarif (`rate`), Budget restant (avec `progress`), Clippers, Seuil, Plafond ;
  - **tuile pédagogique** (greffe) : `alertBox("info", "Vous êtes payé à partir de **2 000 vues** (240 DA) et jusqu'à **200 000 vues** (30 000 DA) par clip.")` ;
  - règles en liste à coches (`icon("check", "size-4 text-income")`) ;
  - plateformes en `platformTag` ;
  - photo de la campagne (`coverArt`, dégradé en repli), ligne « Organisée par » (logo, `nameWithBadge`, lien vers la page de l'agence), toutes les plateformes et la règle « publiez sur une plateforme ou sur toutes » ;
  - pied : `ghost` « Fermer » et `primary` « Rejoindre la campagne » ou « Soumettre un clip ».

**Agences (`cAgences`, `#/clipper/agences`) et page d'une agence (`cAgence`)**
- Page à part dans la navigation (plus d'onglet « Agences | Campagnes » ni de `state.camp.tab`). Cartes avec couverture 3:1 (`cover` de l'agence, dégradé en repli), logo (`avatar`) en chevauchement et badge vérifié.
- **Organisateur** d'une campagne : l'agence propriétaire (`db.agencies`, profil public) ; sans propriétaire, l'agence visible qui porte le nom de la marque, sinon la marque elle-même (clé `brand:<nom normalisé>` par `clNorm` : accents et casse ignorés, toutes écritures, jamais de clé commune à deux marques ; type « Marque partenaire », « campagne gérée par ClipBoost » sur sa page).
- **Vue Agences :** recherche par nom (`camp-aq`), « 3 agences », grille `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` de cartes-liens `min-w-0 CARD CARD_HOVER` (un nom long se tronque, jamais de défilement horizontal) : pastille d'initiales carrée (teinte de l'avatar), nom, ligne de type, présentation sur 2 lignes réservées (`min-h-[2lh]`, chiffres alignés d'une carte à l'autre), `dl` Campagnes actives (mini-couvertures) / Meilleur tarif (`rateShort`) / Budget restant (`money`), catégories et « Voir les projets ». Agences avec une campagne active d'abord, puis par budget restant.
- **Page `#/clipper/agence/<clé>`** (hors navigation : `ITEM_PAGES` dans `main.js`, « Agences » reste courant, l'adresse survit au rechargement) : fil d'Ariane « Agences › nom », bandeau de couverture 3:1, en-tête (logo `size-16`, `nameWithBadge`, badge Agence ou Marque partenaire, pays, « Membre depuis… »), présentation, 4 `kpi` (Campagnes actives, Meilleur tarif, Budget restant, Participations : inscriptions cumulées de ses projets), « Projets de clipping en cours » (cartes §4.4 sans lien organisateur) et « Projets terminés ou en pause » (statut + `btn("soft", "sm")` « Détails »). Clé inconnue : fil d'Ariane, `h1` `sr-only` et `emptyState` « Agence introuvable ».
- Partout ailleurs (carte, liste, fiche), le nom de l'organisateur est un lien vers sa page (`clOrgLink` : cible `HIT`, nom tronqué dans un span intérieur ; dans l'en-tête de la fiche, il passe à la ligne). « Tout voir » des campagnes à découvrir de l'Accueil ouvre Découvrir.

**Mes publications (`cPublications`)**
- `segmented("pub-status", …, [["Toutes","Toutes",4],["Validée","Validées",3],["En attente","En attente",1],["Refusée","Refusées",0]], "Statut")`.
- `publicationsTable(list)` (§4.5).
- **Sous le seuil :** la cellule Gains affiche `—`, avec en sous-ligne « 80 % du seuil » et une mini-progression `progress(views, seuilVues, { label: false, aria: "Progression vers le seuil" })` dans `w-20`.
- « Plafond atteint » : `text-xs text-warning-fg` + `icon("info", "size-3.5")`.
- Motif de refus : `text-xs text-danger-fg` sous le titre.
- **`publicationsTable(list, { showUser, actions, amountLabel })`** est partagée avec C et D. Colonne Décision quand `actions` est vrai : voir §6.4 Modération.

**Portefeuille (`cPortefeuille`)**
- **Mise en page :** `grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]`, sans action dans l'en-tête de page.
- **Colonne gauche** (`grid content-start gap-4`) :
  1. Carte portefeuille : même composant que l'accueil, sans la courbe. Bouton `primary` « Demander un retrait » et ligne « Retrait minimum 2 000 DA ».
  2. Carte « Moyen de retrait » :
     - tuile `grid size-10 place-items-center rounded-tile bg-subtle text-fg-muted` avec `icon("bank")` (RIB) ou `icon("mail")` (CCP, BaridiMob) ;
     - nom du moyen ;
     - `maskAccount()` en `font-mono text-small text-fg-subtle` ;
     - `btn("link")` « Modifier ».
     - **Les cercles « Mastercard » disparaissent.**
- **Colonne droite :** `card` avec `cardHeader("Historique", "", segmented Tous / Gains / Retraits)` et la liste §4.6 regroupée par mois.
- **Masquage corrigé (B) :** `const maskAccount = (a) => { const d = String(a || "").replace(/\D/g, ""); return d ? `••••${NB}${d.slice(-4)}` : ""; };`

**Statistiques (section de l'Accueil ; ancienne page `cStatistiques`)**
- `segmented` 7 j / 30 j dans l'en-tête.
- **KPI** (3) : Gains de la période, Vues totales, **Revenu pour 1 000 vues** (gains validés ÷ vues validées × 1 000, affiché avec `rate()`).
- **Graphique** avec `segmented` « Par jour | Cumulé » : `barChart` ou `cumulativeChart({ h: "h-44" })`.
- **Deux cartes `barList` :**
  - « Vues par plateforme » (`tone: "brand"`, libellé `platformTag`) ;
  - « Gains par campagne » (`tone: "income"`, libellé `coverThumb(c, "xs")` + titre).
- **« Vos meilleurs clips »** en tableau classé : rang `text-small font-medium tabular-nums text-fg-subtle` (« 1 », « 2 », « 3 », sans « # » gris clair).
- **Aucune publication :** `emptyState("chart", …)` avec `btn("primary")` « Voir les campagnes ».

**Profil (`cProfil`)** `grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]`
- **Gauche :** carte formulaire en deux sous-sections (« Informations publiques », « Vos comptes ») séparées par `border-t border-line pt-5 mt-5`. Champs réseaux avec préfixe « @ » (même motif que `unitInput`, préfixe à gauche `pl-8`). `btn("primary")` « Enregistrer » aligné à droite.
- **Droite :**
  - carte identité : `avatar(u, "xl")`, nom `text-section`, « @handle · Algérie » `text-small text-fg-muted`, niveau en `badge(u.level, "brand", { ic: "medal" })` sans 🥈, bio, « Membre depuis… » `text-xs text-fg-subtle` ;
  - photo de profil dans le formulaire (`imageField({ name: "avatar", shape: "avatar" })`, envoyée en `avatar`) ; `accountCard(u)` est passée dans Paramètres (lien « Compte, langue et thème »).

**Paramètres (`cParametres`)**
- **Moyen de retrait :**
  - 3 `SEG_CHOICE` avec icônes (radio `peer sr-only`) ;
  - numéro de compte en `inputCls font-mono` ;
  - aide « Vérifiez ce numéro : les virements sont envoyés tels quels. » ;
  - `btn("primary")` « Enregistrer ».
- **« Comment vous êtes payé » :**
  - `dl divide-y divide-line` (`dt text-sm text-fg-muted`, `dd text-sm font-medium tabular-nums text-right`) avec les vraies valeurs de `db.settings` ;
  - lignes : seuil par campagne, fenêtre de gains, rétention, retrait minimum, frais instantanés.
- **Préférences** : `langSwitch({ full: true })` et `themeModeSwitch({ labels: true })` ; puis `accountCard(u)`.

**Modales**
- **Soumettre un clip** (`modalShell({ title, form: "submit", live: "clip" })`, brouillon et champs conditionnels du §4.8) :
  - Campagne (`select` `data-rerender`, libellés « Derby Algérois · 150 DA / 1k vues ») ;
  - Titre ;
  - « Où avez-vous publié ce clip ? » : `CHOICE` « Sur toutes les plateformes de la campagne » ou « Sur une seule plateforme » (`data-rerender`, rien de présélectionné ; une campagne à une seule plateforme remplace la question par une note), puis, pour « une seule », les plateformes en `SEG_CHOICE` (icônes `tiktok`, `instagram`, `youtube`, `facebook`) ;
  - un champ de lien par plateforme retenue (`url-<Plateforme>`, `dir="ltr"`, `PLATFORM_PLACEHOLDER`, coche verte `LIVE.clip` dès que le lien pointe vers sa plateforme en https) ;
  - envoi `{ campaignId, title, links: [{ platform, url }] }` : un clip par plateforme, liés par le même `batch` (« Aussi publié sur … » dans les listes) ;
  - pied `ghost` « Annuler » + `primary` « Envoyer pour validation ».
- **Demander un retrait :** §4.7.
- **Toasts du lot :** sans emoji. Par exemple « Ajoutée aux favoris », « Vous avez rejoint « Derby Algérois » », « Demande de retrait de 7 078 DA envoyée ».

### 6.3 Espace Agence (lot C, `web/src/agency.js`)

**Ajouts du lot « 16 demandes » (contrats, le code de `agency.js` fait foi pour le détail)**
- Navigation : `apercu` s'affiche « Accueil » (identifiant inchangé, pas de fusion avec une autre page) ; nouvelle page `parametres` « Paramètres » (`gear`) : langue, thème, compte et mot de passe (`accountCard`).
- Profil de l'agence : logo (`imageField({ name: "avatar", shape: "avatar" })`) et photo de couverture (`shape: "cover"`, bandeau 3:1) ; demande du badge de vérification (`ag-verify`, message facultatif) et son état (en cours d'examen, refusée avec le motif, vérifiée avec `verifiedBadge`).
- Formulaire de campagne `campaignForm(formName, submitLabel, note, c)` : 18 catégories + « Autre » qui révèle « Précisez la catégorie » ; photo de la campagne (`shape: "campaign"`) ; plateformes en tuiles à case visible (TikTok, Instagram, YouTube, Facebook) sous une case « Toutes les plateformes » ; « Recharger le crédit » ouvre la recharge **empilée** (`openStacked`), le formulaire revient avec sa saisie.
- Campagne en attente : « Modifier » (`ag-edit`) et « Annuler la campagne » (`ag-cancel`) ; campagne refusée : motif (`reviewNote`), « Modifier et relancer » (`ag-edit`) et « Supprimer » (`ag-delete`).
- Recharge : méthode « carte Visa / Mastercard » ; champs de carte `data-nodraft` avec `autocomplete="cc-number|cc-exp|cc-csc|cc-name"` (jamais gardés dans un brouillon).

**Aperçu (`gApercu`)**
- `pageHeader` « Bonjour Nassim » + « Tassili Sport », action `lg:hidden` « Nouvelle campagne ».
- **Première campagne** (liste vide) :
  - carte `rounded-card bg-night p-6 text-on-brand sm:p-8` ;
  - titre `text-heading text-on-brand`, texte `text-on-brand/80` ;
  - `btn("onColor")` « Créer ma première campagne ».
- **KPI** (aucun en vert : ce sont des dépenses) :
  - Crédit disponible (`bigMoney`) avec `btn("link")` « Recharger » ;
  - Budget consommé (sous-ligne « sur 900 000 DA engagés », `progress(…, { label: false })`) ;
  - Vues générées (sous-ligne « soit 150 DA / 1 000 vues », coût effectif = consommé ÷ vues × 1 000) ;
  - Clips reçus (« 2 en modération »).
- **Rangée `lg:grid-cols-[1.4fr_1fr]` :**
  - « Budget consommé par jour » : `barChart(db.series.daily, { tone: "brand", caption: … })` ;
  - « Vos campagnes » : liste compacte (vignette `coverThumb`, titre, `statusBadge`, `progress` sans libellé, `rateShort(c.rate)` · clippers).
- **Derniers clips reçus :** `publicationsTable(list, { amountLabel: "Coût" })`.

**Mes campagnes (`gCampagnes`)**
- Barre d'outils : `searchInput("ag-q", …)` + `segmented("ag-status", …)` avec compteurs.
- Cartes : variante agence (§4.4).
- **État vide :** `emptyState("megaphone", "Aucune campagne", "…", btn("primary") « Nouvelle campagne »)`.
- **Modal Détails :**
  - tuiles `TILE` (Tarif, Seuil, Plafond, Clippers, Clips, Vues), `progress`, règles ;
  - tableau compact des clips reçus ;
  - pied : pause ou reprise en `secondary`, `primary` « Ajouter du budget ».

**Clips reçus (`gClips`)** : `segmented` statuts + `publicationsTable(list, { amountLabel: "Coût" })`. Description d'en-tête : « Modération assurée par l'équipe ClipBoost. »

**Budget (`gBudget`)**
- **Carte de synthèse** `grid gap-4 sm:grid-cols-4 sm:divide-x sm:divide-line` (padding interne `sm:px-4 first:pl-0`) :
  - Crédit disponible (`bigMoney(…, "money")` + `btn("primary")` « Recharger le crédit ») ;
  - Engagé ;
  - Consommé ;
  - Restant.
- **Tableau « Par campagne » :**
  - colonnes : Campagne (vignette, titre, statut), Tarif (`tdNum`), Consommé (`progress` dans `min-w-48`), Restant (`tdNum`), Action ;
  - action : `btn("ghost", "sm")` « Ajouter du budget » avec icône `plus`, ou « Archivée » en `text-xs text-fg-subtle`.
  - **Plus aucun bouton sur deux lignes** (`whitespace-nowrap` est dans `BTN.base`).
- **Recharges :** liste ou tableau d'historique (Date, Moyen, Référence `code()` + bouton Copier, Statut, Montant `money(+n, { signed: true })` en vert, car le crédit entre).
- **Modales :** §4.7 (`LIVE.budget`, recharge).

**Profil de l'agence (`gProfil`)** : même grille que le profil clipper (formulaire à gauche, identité et `accountCard(u)` à droite).

**Nouvelle campagne** (`campaignForm(formName, submitLabel, note)`, signature inchangée, aussi utilisée par D) dans `modalShell({ size: "xl", form: formName, live: "campaign" })`, en 4 `fieldset` :
- chaque `fieldset` porte `border-t border-line pt-5 mt-5 first:mt-0 first:border-0 first:pt-0` ;
- chaque `legend` porte `text-section text-fg`.
1. **Campagne :**
   - titre ;
   - marque (admin seulement) ;
   - catégorie ;
   - visuel en `SEG_CHOICE` d'emoji `size-11` (la donnée reste un emoji, c'est autorisé).
2. **Rémunération :**
   - champs `unitInput` tarif (« DA / 1 000 vues »), seuil (« DA ») et plafond (« DA ») ;
   - sous chaque champ, l'équivalent en vues en direct (« = 2 000 vues »).
3. **Budget :**
   - `unitInput(…, "DA")` ;
   - aperçu en direct `summary` : « Budget 200 000 DA · Commission 15 % 30 000 DA · **Débité à l'approbation 230 000 DA** ».
4. **Diffusion :** plateformes (`SEG_CHOICE` multiples, en cases à cocher) et règles (`textareaCls`).
- `LIVE.campaign` est enregistré par C ; `campaignPayload(data)` est inchangé.

### 6.4 Administration (lot D, `web/src/admin.js`)

**Ajouts du lot « 16 demandes » (contrats, le code de `admin.js` fait foi pour le détail)**
- Pages hors navigation : `utilisateur` (`#/admin/utilisateur/<id>`, `ITEM_PAGES` : « Utilisateurs » reste courant) et `compte` « Mon compte » (photo, nom, langue, thème, mot de passe), ouverte par le menu du compte.
- `admUserLink(u, cls)` : tout nom d'agence ou de clipper affiché dans l'administration est un lien vers sa fiche (`nameWithBadge`). Réservé à l'administration : ailleurs, les noms restent du texte.
- Fiches d'examen : `adm-camp` (campagne complète : photo, catégorie, tarif, budget, seuils, plateformes, règles, agence ; « Approuver », « Refuser » → `adm-refuse` avec motif obligatoire) et `adm-clip` (clip, liens, campagne, clipper, décision). Ouvertes aussi par `#/admin/campagnes/<id>` et `#/admin/moderation/<id>` (`applyRouteItem`).
- Badge de vérification des agences : accorder, refuser ou retirer (`adm-verify` pour le motif) ; `adminBadge("utilisateurs")` compte les demandes en attente.

**Vue d'ensemble (`aApercu`)**
1. **« À traiter »** `grid gap-3 sm:grid-cols-3` : `kpi({ href, ic: "chevronRight", … })` (cartes interactives) avec :
   - libellé ;
   - nombre (`kpiValue`) + `countBadge(n, "queue")` ;
   - sous-ligne ;
   - `icon("chevronRight")` à droite.
   - Les trois cartes : Clips à modérer, Campagnes à approuver, Paiements à traiter (avec la somme en `money`).
   - **Neutres : plus de rose.**
2. **KPI plateforme :**
   - Clippers inscrits (« 0 suspendu ») ;
   - Campagnes actives ;
   - Budget consommé ;
   - Commissions ClipBoost (`money(…, { signed: true })` vert : argent entrant pour la plateforme).
3. **Rangée :**
   - « Nouvelles inscriptions » : `barChart(…, { tone: "brand", unit: "inscription", integer: true })` ;
   - « Activité récente » : liste `divide-y divide-line` (`eventIcon`, texte `text-small`, temps `text-xs text-fg-subtle`). **État vide obligatoire** : « Aucune activité sur les 7 derniers jours ».
4. **Clips en attente :** `publicationsTable(list.slice(0, 3), { showUser: true, actions: true })` + `sectionHeader` « Tout voir ».
- Si la maintenance est active : `alertBox("warning", …)` en tête, avec un lien vers Réglages (au lieu du bloc rose).

**Utilisateurs (`aUtilisateurs`)**
- **Barre d'outils sur une ligne :** `searchInput("adm-user-q", …)`, `segmented("adm-user-role", …)` (Tous, Clippers, Agences, Admins), `select` statut.
- **Tableau :**
  - Utilisateur (`avatar(u, "sm")`, nom + `roleTag(u)` réécrit en `roleBadge(u.role)`, email `tdSub`) ;
  - Pays ;
  - Inscription ;
  - **Solde** (`tdNum` : `money()` + `tdSub` « gains » ou « crédit ») ;
  - Statut ;
  - Actions : `btn("ghost", "sm")` « Détails » + `btn("secondary", "sm")` « Suspendre » ou « Réactiver ».
- **La suspension demande une confirmation :** `modalShell` avec pied `btn("danger")` « Suspendre le compte ».

**Campagnes (`aCampagnes`)**
- Barre d'outils : recherche + `chips("adm-camp-status", …)` avec compteurs ; `primary` « Nouvelle campagne » dans l'en-tête.
- **Tableau :** Campagne (vignette, titre, « Marque · Catégorie · par l'agence X ») · Statut · Tarif (`tdNum`) · Budget (`progress` dans `min-w-44`) · Clippers (`tdNum`) · Actions (`TBL.tdActions`).
- **Actions par statut** (sur une ligne) :
  - En attente : `primary sm` « Approuver » + `dangerSoft sm` « Refuser » ;
  - Active : `secondary sm` « Pause » (icône `pause`) + `ghost sm` « Terminer » ;
  - En pause : `secondary sm` « Reprendre » (icône `play`) + `ghost sm` « Terminer ».

**Modération (`aModeration`)** (la colonne Décision est rendue par `publicationsTable`, lot B, selon cette recette)
- Règles longues dans un `<details>` (`alertBox("info", …)` avec un résumé d'une ligne).
- `segmented` En attente / Validée / Refusée / Toutes.
- **Colonnes :** Clip · Clippeur · Plateforme · Vues (`tdNum` + `tdSub` « seuil 2 000 ») · Gain estimé (`tdNum`) · Décision.
- **Décision** (`TBL.tdActions`, **sur une seule ligne**) :
  - `iconBtn("sm", true)` « Relever les vues » (icône `eye`, `aria-label`) ;
  - `btn("dangerSoft", "sm")` « Refuser » ;
  - `btn("primary", "sm")` « Valider ».
  - **Sous le seuil :** « Valider » est remplacé par `<span class="text-xs font-medium text-warning-fg">Seuil : 80${NB}%</span>` + mini-progression. Plus de puce grise qui ressemble à un bouton désactivé.
- **Mobile :** les actions passent en boutons `md` dans `grid grid-cols-[auto_1fr_1fr] gap-2`.
- **Modal de refus :**
  - motifs en `CHOICE_DANGER` ;
  - pied `btn("danger")` « Confirmer le refus ».
- **Modal de relevé de vues :**
  - `unitInput(…, "vues")` ;
  - aide « Seuil 2 000 vues · plafond 200 000 vues. Le nombre ne peut pas diminuer. » ;
  - lien `btn("link")` « Ouvrir le clip » avec icône `external`.

**Paiements (`aRetraits`)**
- Onglets soulignés `TABLIST` / `TAB` : « Retraits des clippers » + `countBadge`, « Recharges des agences » + `countBadge`.
- **Tableau Retraits :**
  - Bénéficiaire (avatar + nom) ;
  - Moyen et compte : `badge("BaridiMob", "idle")` + `groupAccount(acc)` en `font-mono text-small` + `iconBtn("sm")` Copier (`aria-label="Copier le numéro"`, `copy(acc, "Numéro copié")`) ;
  - Référence (`code(ref)`) ;
  - Demandé le ;
  - Montant (`tdNum`) ;
  - Frais (`tdNum text-fg-muted`) ;
  - **Net à virer** (`tdNum font-semibold`) ;
  - Actions : `primary sm` « Virement effectué » + `dangerSoft sm` « Rejeter ».
- **Tableau Recharges :** Agence · Moyen · Référence (`code()` + Copier) · Date · Montant · Actions (`primary sm` « Paiement reçu », `dangerSoft sm` « Rejeter »).
- **Mobile :** une carte par demande ; le compte et la référence ont chacun leur ligne en mono avec Copier ; les boutons sont en `md`.

**Réglages (`aParametres`)** : modèle « liste de réglages »
- **Une carte par groupe :** Accès, Annonce, Argent, Délais.
- **Une ligne par réglage :** `flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between`, en `divide-y divide-line` :
  - à gauche : titre `text-sm font-medium text-fg` + description `text-small text-fg-muted` ;
  - à droite : contrôle `sm:w-48`, `unitInput` avec suffixe (« DA », « % », « jours »), ou `switchBtn`.
- **Annonce :** `textareaCls` + compteur `text-xs tabular-nums text-fg-subtle` (« 0 / 140 »).
- **Enregistrement :** pied collant `sticky bottom-0 -mx-5 -mb-5 mt-4 flex justify-end border-t border-line bg-surface/95 px-5 py-3 backdrop-blur-md` avec `btn("primary")` « Enregistrer ».
- **Réinitialiser la démo :** carte séparée en bas, `btn("dangerSoft")`, confirmation avec `btn("danger")`.

**`roleTag`** (local à `admin.js`) : le réécrire en appel de `roleBadge(u.role)` (garder le nom `roleTag` dans `admin.js`).

### 6.5 Connexion et inscription (lot E, `web/src/auth.js`)

**Ajouts du lot « 16 demandes »** : boutons « Continuer avec Google / Apple / Discord » (fournisseurs de `db.oauth`, séparateur « ou ») sur la connexion et l'inscription ; message d'erreur `?oauth_error=<code>` lu au chargement puis retiré de l'adresse ; `langSwitch()` visible sur les écrans de connexion. Dans la version autonome, la connexion simulée passe par `POST /api/auth/oauth/demo`.

- **`authLayout`** : `grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]`.
- **Panneau gauche** `relative hidden overflow-hidden bg-night p-12 text-on-brand lg:flex lg:flex-col` :
  - halos `pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl` et `… -bottom-32 -right-16 size-80 bg-night-income/15 blur-3xl` ;
  - `logo({ tone: "text-on-brand" })` ;
  - `h2` `mt-auto text-h2 text-on-brand text-balance` (« Vos clips méritent d'être payés. ») ;
  - texte `mt-4 max-w-md text-lg leading-8 text-on-brand/80` ;
  - **3 garanties réelles** tirées de `db.settings`, en `ul mt-10 grid gap-4`, chaque ligne `flex items-center gap-3 text-sm text-on-brand/80` avec une pastille `grid size-8 place-items-center rounded-full bg-on-brand/10 text-on-brand` :
    - « Retrait dès 2 000 DA vers BaridiMob, CCP ou RIB » (`wallet`) ;
    - « Gains libérés après 3 jours de contrôle » (`shield`) ;
    - « Commission affichée, aucun frais caché » (`check`) ;
  - **courbe décorative sans chiffres** : `<div class="mt-10 opacity-90">${cumulativeChart([0,2,1,4,3,6,5,8,9,7,11,12], { h: "h-20", onNight: true, label: "Illustration" })}</div>`, avec `aria-hidden="true"` sur le conteneur (c'est une illustration) ;
  - pied `mt-10 flex items-center gap-2 text-xs text-on-brand/65` : « © 2026 ClipBoost · Fait en Algérie » + `flagDz()`.
- **Panneau droit** `flex flex-col px-4 py-6 sm:px-10` :
  - barre `flex items-center justify-between` : `<span class="lg:invisible">${logo({ size: "sm" })}</span>`, puis `btn("ghost", "sm")` « Retour au site » (icône `arrowLeft`) et `themeToggle()` ;
  - formulaire `mx-auto my-auto w-full max-w-sm py-10` : `h1` `text-title text-fg`, sous-titre `mt-2 text-sm text-fg-muted`, `mt-8 grid gap-4`, champs `inputCls + inputLg` ;
  - **bouton principal violet sur tous les écrans** : `btn("primary", "lg", "w-full")` ;
  - liens secondaires `btn("link")`.
  - **Afficher le mot de passe :** `iconBtn("sm")` dans le champ (`absolute right-1.5 top-1/2 -translate-y-1/2` sur un conteneur `relative`, champ `pr-11`), avec `aria-pressed` et l'icône `eye`.
- **Erreurs :**
  - `errorBox` devient `alertBox("danger", msg)` ;
  - champs en erreur via `field(…, error)` et `aria-invalid="true"`.
- **Inscription :**
  - rôle en 2 `CHOICE` avec icônes `film` (Clipper) et `building` (Agence), sans emoji (`roleCard` local réécrit) ;
  - jauge de force en 4 segments `grid grid-cols-4 gap-1.5`, chaque segment `h-1 rounded-full bg-muted` puis `bg-danger-solid`, `bg-warning-solid` ou `bg-success-solid`, plus le libellé `text-xs` dans la couleur `-fg` correspondante ;
  - conditions : `CHECKBOX`.
- **Vérification :**
  - pastille `grid size-12 place-items-center rounded-full bg-brand-soft text-brand-fg` avec `icon("mail")` ;
  - code OTP en `inputCls inputLg font-mono tracking-[0.4em] text-center`, `inputmode="numeric" autocomplete="one-time-code"`.
  - `devCodeNotice` devient `alertBox("warning", …)`, avec le code en `code()`.
- **`demoAccounts`** : `alertBox("info", …)`, avec les emails en `code()` et un bouton Copier par compte.
- **Inscriptions fermées :** `emptyState("lock", "Inscriptions fermées", …, btn("secondary") « J'ai déjà un compte »)`.
- **Toasts :** « Compte créé, bienvenue Yacine » et « Mot de passe modifié », sans emoji.

### 6.6 À 390 px (vérifications obligatoires, tous lots)

- **KPI :** `grid-cols-2 gap-3`, `p-4`, valeur `text-xl`. La carte portefeuille vient en premier, en pleine largeur.
- **Tableaux :** repli en liste (`md:hidden`), actions en boutons `md` sous l'élément.
- **Barres d'outils :** recherche, puis une rangée défilante. Jamais plus de 2 rangées avant le contenu.
- **Modales :**
  - en feuille depuis le bas (`rounded-t-panel`, poignée) ;
  - pied empilé (`flex-col-reverse` : l'action principale en bas, sous le pouce) ;
  - zone sûre respectée.
- **Champs** en 16 px (pas de zoom iOS).
- **Rien ne déborde horizontalement** (`min-w-0` sur les colonnes flexibles, `truncate` sur les titres).
- **Barre du haut :** logo `sm`, notifications, avatar. Le thème passe dans le tiroir.

---

## 7. Landing page (lots F et G)

**Règles communes :**
- Les composants copient les chaînes de classes des recettes du §4 (mêmes tokens). Pas de `dark:`, sauf pour l'icône du thème.
- **Aucune nouvelle dépendance ni nouveau fichier.** Les icônes sont des SVG en ligne, avec les mêmes tracés que `icons` de `ui.js`, en `strokeWidth="1.75"`.
- **Rythme :**
  - sections `py-20 lg:py-28` sur `bg-surface`, en alternance avec `bg-canvas` (Campagnes, Pour qui, FAQ) ;
  - conteneur `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` ;
  - ancres `scroll-mt-20`.
- **Boutons en JSX :** chaînes équivalentes à `btn()`.

```tsx
// À recopier en tête des composants qui en ont besoin (pas de fichier partagé).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const LG = "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5";
const MD = "h-10 rounded-control px-4 text-sm [&_svg]:size-4";
const PRIMARY = "bg-brand text-on-brand shadow-control hover:bg-brand-hover active:bg-brand-active";
const SECONDARY = "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle";
const GHOST = "text-fg-muted hover:bg-muted hover:text-fg";
const ON_COLOR = "bg-on-brand text-brand-700 shadow-control hover:bg-brand-50";
const ON_COLOR_GHOST = "bg-on-brand/10 text-on-brand ring-1 ring-inset ring-on-brand/25 hover:bg-on-brand/15";
```

**Drapeau en JSX** (Hero, Footer ; identique à `flagDz()`) :

```tsx
<svg viewBox="0 0 30 20" className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-fg/10" role="img" aria-label="Algérie">
  <rect width="15" height="20" fill="#006233" /><rect x="15" width="15" height="20" fill="#ffffff" />
  <mask id="dz-crescent-hero"><rect width="30" height="20" fill="#fff" /><circle cx="16.25" cy="10" r="4" fill="#000" /></mask>
  <circle cx="15" cy="10" r="5" fill="#d21034" mask="url(#dz-crescent-hero)" />
  <polygon fill="#d21034" points="15.50,10.00 16.91,9.50 16.95,8.00 17.86,9.19 19.30,8.77 18.45,10.00 19.30,11.23 17.86,10.81 16.95,12.00 16.91,10.50" />
</svg>
```

L'`id` du masque doit être unique par instance : `dz-crescent-hero`, `dz-crescent-footer`.

### 7.1 `Header` (F)

- **Conteneur :** `sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md`, rangée `mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8`.
- **Liens :** `rounded-sm text-sm font-medium text-fg-muted transition-colors hover:text-fg ${FOCUS}`, **sans emoji** (retirer le champ `icon` du tableau `links`).
- **À droite (`lg`) :** `<ThemeToggle />`, « Se connecter » (`${BTN} ${MD} ${GHOST}`), « Commencer gratuitement » (`${BTN} ${MD} ${PRIMARY}`).
- **Mobile :**
  - `ThemeToggle` + bouton menu `inline-grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-muted hover:text-fg ${FOCUS}` ;
  - **garder** `aria-controls="menu-mobile"`, `aria-expanded`, l'`aria-label` et **un seul `<path>`** dans le SVG (le script hors ligne réécrit son attribut `d`).
- **`#menu-mobile` :**
  - `border-t border-line bg-surface px-4 pb-5 pt-2 lg:hidden` + `hidden` quand il est fermé (classe basculée par le script hors ligne) ;
  - liens `flex h-11 items-center rounded-lg px-3 text-[15px] font-medium text-fg hover:bg-subtle` ;
  - puis `grid gap-2` avec deux boutons `${BTN} ${LG}` (`SECONDARY` « Se connecter », `PRIMARY` « Commencer gratuitement »).

### 7.2 `Logo` (F), props `{ className?: string }`

```tsx
<a href="/" className={`inline-flex items-center gap-2.5 rounded-control ${FOCUS} ${className ?? ""}`} aria-label="ClipBoost, accueil">
  <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-brand text-on-brand">
    <svg viewBox="0 0 24 24" className="size-[18px] translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
  </span>
  <span className="inline-block -skew-x-6 font-display text-[1.375rem] font-extrabold leading-none tracking-[-0.03em] text-fg" aria-hidden="true">ClipBoost</span>
</a>
```

Footer (G) l'utilise tel quel. Le mot-symbole suit `text-fg`, il bascule seul.

### 7.3 `ThemeToggle` (F)

- Garder `toggleTheme()`, `data-theme-toggle`, `aria-label` et `title`.
- Classes : `inline-grid size-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg ${FOCUS} [&_svg]:size-5`.
- Lune : `className="dark:hidden"`. Soleil : `className="hidden dark:block"`. Trait 1,75.
- Mettre à jour le commentaire : `app/dark.css` ne contient plus que des variables.

### 7.4 `Hero` (F) et `IncomeCard` (F)

- **Grille :** `relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-20`.
- **Pastille :** `inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-small font-medium text-fg-muted shadow-control` + drapeau + « La plateforme de clipping pensée pour l'Algérie ».
- **H1 :** `mt-6 text-h1 text-fg sm:text-display` (Jakarta, `text-wrap: balance` par la base), avec « revenus » en `text-brand-fg`.
- **Chapô :** `mt-5 max-w-xl text-lg leading-8 text-fg-muted`.
- **CTA :** `mt-8 flex flex-col gap-3 sm:flex-row` : « Devenir clipper » (`${BTN} ${LG} ${PRIMARY}`) et « Lancer une campagne » (`${BTN} ${LG} ${SECONDARY}`). **Sans 🚀.**
- **Preuve sociale :**
  - `mt-8 flex items-center gap-3` ;
  - pile `flex -space-x-2` de 4 avatars `grid size-8 place-items-center rounded-full text-[11px] font-semibold text-on-brand ring-2 ring-surface`, en `bg-avatar-1` à `bg-avatar-4` ;
  - texte `text-small text-fg-muted` : « <strong className="font-semibold text-fg tabular-nums">12&nbsp;400</strong> clippers inscrits ».
- **Visuel produit** (à droite) :
  - `relative` ;
  - halo `pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 bg-[radial-gradient(55%_55%_at_60%_35%,color-mix(in_oklab,var(--color-brand)_14%,transparent),transparent_70%)]` ;
  - fenêtre `rounded-panel border border-line bg-canvas p-3 shadow-modal sm:p-4` ;
  - barre de fenêtre `mb-3 flex items-center gap-1.5 px-1` (3 points `size-2.5 rounded-full bg-line-strong`, URL `ml-2 text-micro text-fg-subtle` « clipboost.dz/espace ») ;
  - badge `idle` « Exemple » à droite : `ml-auto inline-flex h-6 items-center rounded-badge border border-idle-border bg-idle-bg px-2 text-xs font-medium text-idle-fg` ;
  - dedans `grid gap-3` :
    - `<IncomeCard />` ;
    - `rounded-card border border-line bg-surface p-2 shadow-card` contenant 2 `<TransactionRow t={…} />`.
  - **Puce flottante :**
    - `absolute -bottom-5 left-6 hidden items-center gap-3 rounded-control border border-line bg-surface-raised px-3.5 py-2.5 shadow-popover md:flex` ;
    - icône `eye` dans `grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-fg` ;
    - texte « Vues cette semaine » `text-xs text-fg-subtle` / `text-sm font-semibold tabular-nums text-fg` « +248 300 ».
    - Plus de 📈.
- **`IncomeCard`** (props `{ amount?: string; trend?: string }`, défauts `formatDA(48200)` et `"+12,4 %"`) :
  - `overflow-hidden rounded-card border border-line bg-surface shadow-card` ;
  - en-tête `p-5` :
    - « Solde disponible » `text-small font-medium text-fg-muted` ;
    - montant `mt-1 text-[1.875rem] font-semibold leading-9 tracking-[-0.03em] text-fg sm:text-money` (Geist) ;
    - badge tendance `inline-flex h-6 items-center gap-1 rounded-badge border border-success-border bg-success-bg px-2 text-xs font-medium tabular-nums text-success-fg` + icône `trend` ;
  - courbe bord à bord `h-24 pr-4` : **cumul** de `incomeCurve`.

```tsx
// Même construction que cumulativeChart() (ui.js) : cumul, cubique monotone, trait 2 px, point HTML.
const cum = incomeCurve.reduce<number[]>((a, v) => [...a, (a.at(-1) ?? 0) + v], []);
const max = Math.max(...cum), W = 300, H = 100, step = W / (cum.length - 1);
const pts = cum.map((v, i) => [i * step, H - (v / max) * (H - 6)] as const);
const d = pts.reduce((s, [x, y], i) => (i ? `${s} C ${(pts[i - 1][0] + x) / 2} ${pts[i - 1][1].toFixed(2)}, ${(pts[i - 1][0] + x) / 2} ${y.toFixed(2)}, ${x} ${y.toFixed(2)}` : `M ${x} ${y.toFixed(2)}`), "");
const [ex, ey] = pts[pts.length - 1];
// <div className="relative h-24 pr-4"><div className="relative size-full">
//   <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
//     <path d={`${d} L 300 100 L 0 100 Z`} className="fill-chart-income/12" />
//     <path d={d} className="fill-none stroke-chart-income" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
//   <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-income ring-2 ring-surface" style={{ left: `${(ex / W) * 100}%`, top: `${(ey / H) * 100}%` }} />
// </div></div>
```

### 7.5 `StatsStrip`, `HowItWorks`, `SectionTitle`, `Campaigns`, `CampaignCard` (F)

- **`SectionTitle`** (props inchangées) :
  - `mx-auto max-w-2xl text-center` ;
  - surtitre `text-small font-semibold uppercase tracking-[0.08em] text-brand-fg` ;
  - `h2` `mt-3 text-h2 text-fg lg:text-h1` ;
  - texte `mt-4 text-lg leading-8 text-fg-muted`.
- **`StatsStrip`** :
  - `border-y border-line bg-surface` ;
  - `dl` `mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:divide-x lg:divide-line lg:px-8` ;
  - chaque bloc `flex flex-col-reverse items-center gap-1 text-center` : valeur `dd` `font-sans text-[1.875rem] font-semibold leading-9 tracking-[-0.025em] text-fg`, libellé `dt` `text-small text-fg-muted` ;
  - note `col-span-full text-center text-xs text-fg-subtle` « Chiffres au 1er octobre 2026 ».
- **`HowItWorks`** : `ol grid gap-4 md:grid-cols-3`. Chaque étape :
  - `relative rounded-card border border-line bg-surface p-6 shadow-card` ;
  - en-tête `flex items-center justify-between` : pastille `grid size-8 place-items-center rounded-full bg-brand-soft text-small font-semibold tabular-nums text-brand-fg` (1, 2, 3) et icône `size-5 text-fg-subtle` (`target`, `film`, `wallet` par index ; le champ `icon` de `steps` est ignoré) ;
  - titre `mt-5 text-section text-fg` (h3) ;
  - texte `mt-2 text-[15px] leading-7 text-fg-muted` ;
  - connecteur desktop `md:after:absolute md:after:-right-4 md:after:top-10 md:after:h-px md:after:w-4 md:after:bg-line-strong`, sauf la dernière (`md:last:after:hidden`).
  - **Plus de « 01 » en gris clair ni d'emoji.**
- **`Campaigns`** (section `bg-canvas`) :
  - barre `mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between` ;
  - **recherche** (garder `type="search"`) : `label relative block w-full lg:max-w-sm`, icône `pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle`, champ = `inputCls` de §4.2 + `h-11 pl-9` ;
  - **onglets** (garder `role="tablist"`, `role="tab"`, `aria-selected`, le libellé seul dans le bouton) :
    `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-small font-medium text-fg-muted ring-1 ring-inset ring-line-strong transition-colors not-aria-selected:hover:text-fg aria-selected:bg-brand aria-selected:text-on-brand aria-selected:ring-brand ${FOCUS}` ;
    conteneur `-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0` ;
  - grille `mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` ;
  - **état vide :** `mt-10 flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center` (icône `search` dans `grid size-10 place-items-center rounded-full bg-muted text-fg-subtle`, titre `mt-3 text-sm font-semibold text-fg`).
- **`CampaignCard`** : structure du §4.4, en JSX :
  - `article` avec `data-category={c.category}` et `data-search={(c.title + " " + c.brand).toLowerCase()}` (lus par le script hors ligne) ;
  - couverture `<div className="cover relative aspect-[16/9] overflow-hidden rounded-tile" data-cat={c.category}>` (le champ `gradient` n'est plus lu) ;
  - puce de tarif `rateShort` sur `bg-night/80` ;
  - « Top campagne » avec étoile SVG (`bg-on-brand/90 text-night`) ;
  - `dl` : « Générés » `text-income` (`formatDA(c.generated, { signed: true })`) et « Créée le » ;
  - **bouton copier** (garder `data-copy`, **ne pas** utiliser la chaîne `bg-brand-50 text-brand-700 hover:bg-brand-100`) :
    - `${BTN} h-8 w-full rounded-lg px-3 text-small border border-line-strong bg-surface text-fg shadow-control hover:bg-subtle [&_svg]:size-4` avec icône `copy` ;
    - état copié : icône `check` + « Lien copié » en `text-success-fg`.

### 7.6 `Earnings` (G) : maquette de portefeuille

- **Section** `id="gains"` : `grid items-center gap-14 lg:grid-cols-2`.
- **Côté visuel**, cadre `rounded-panel border border-line bg-canvas p-3 shadow-modal sm:p-4`, badge « Exemple » comme au héros, puis `grid gap-3` :
  1. **Moyen de retrait :**
     - `flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card` ;
     - tuile `grid size-10 place-items-center rounded-tile bg-subtle text-fg-muted` avec icône `bank` ;
     - « BaridiMob » `text-sm font-medium text-fg` / « •••• 5678 » `font-mono text-small text-fg-subtle` ;
     - à droite, badge `success` « Vérifié ».
  2. **Gains par campagne** (liste en barres, même recette que `barList`) :
     - carte `rounded-card border border-line bg-surface p-5 shadow-card`, titre `text-section` ;
     - lignes `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5` : vignette `cover size-5 rounded-[4px]` + titre, montant `text-sm font-medium tabular-nums` ;
     - piste `col-span-2 h-2 rounded-full bg-muted`, remplissage `h-full rounded-full bg-chart-income` ;
     - données : les 3 premières campagnes de `campaigns`, triées par `generated`.
  3. **Historique :** `rounded-card border border-line bg-surface p-2 shadow-card` avec les 3 `<TransactionRow t={t} />`.
  - **`IncomeCard` n'est plus utilisée ici. Supprimer « Inviter un créateur 🙋 ».**
- **Côté texte :** `SectionTitle` aligné à gauche (envelopper avec `[&>div]:mx-0 [&>div]:text-left`), puis `ul mt-8 grid gap-4` de 3 points. Chaque point : `flex gap-3`, pastille `grid size-6 shrink-0 place-items-center rounded-full bg-income-soft text-income` (icône `check` `size-3.5`), texte `text-[15px] leading-7 text-fg-muted` avec un début en `font-medium text-fg`.

### 7.7 `TransactionRow` (G), props `{ t: Transaction }` inchangées

```tsx
<div className="flex items-center gap-3 rounded-tile px-3 py-2.5">
  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-income-soft text-income" aria-hidden="true">{/* icône arrowDownLeft, size-4 */}</span>
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium text-fg">Gains de campagne</p>
    <p className="text-xs tabular-nums text-fg-subtle">{t.date} · {t.time}</p>
  </div>
  <div className="text-right">
    <p className="text-sm font-medium tabular-nums text-income">{formatDA(t.amount, { signed: true })}</p>
    {/* badge : "Validé" → success (point), "En cours" → info (point) */}
    <span className="mt-1 inline-flex h-5 items-center gap-1.5 rounded-badge border border-success-border bg-success-bg px-1.5 text-[11px] font-medium text-success-fg"><span className="size-1.5 rounded-full bg-success-solid" />{t.status}</span>
  </div>
</div>
```

### 7.8 `Audiences` (G), section `bg-canvas`

`grid gap-4 lg:grid-cols-2`, cartes `rounded-card p-8 sm:p-10` :
- **Clipper :**
  - `border border-line bg-surface shadow-card` ;
  - icône `film` dans `grid size-11 place-items-center rounded-tile bg-brand-soft text-brand-fg` ;
  - titre `mt-6 text-heading text-fg` ;
  - liste à puces `size-5 rounded-full bg-brand-soft text-brand-fg` (icône `check`) ;
  - CTA `${BTN} ${LG} ${SECONDARY}` « Devenir clipper ».
- **Marque :**
  - `bg-brand-panel text-on-brand` (violet en clair, `#4c1d95` en sombre) ;
  - icône `building` dans `bg-on-brand/15 text-on-brand` ;
  - texte `text-on-brand/90` ;
  - puces `bg-on-brand/15 text-on-brand` ;
  - CTA `${BTN} ${LG} ${ON_COLOR}` « Lancer une campagne », **sans 🚀**. Il reste blanc en sombre, ce qui corrige le bug actuel.

### 7.9 `Testimonials` (G)

- Cartes `flex flex-col rounded-card border border-line bg-surface p-6 shadow-card`.
- Guillemet `font-display text-4xl leading-none text-brand-fg` (« “ »).
- Citation `mt-3 flex-1 text-[15px] leading-7 text-fg`.
- Auteur `mt-6 flex items-center gap-3` :
  - avatar `grid size-10 place-items-center rounded-full text-xs font-semibold text-on-brand` + fond pris dans un tableau de classes **complètes** (`["bg-avatar-1", "bg-avatar-2", "bg-avatar-3"][i]`) : Tailwind ne détecte pas une classe construite par concaténation ;
  - nom `text-sm font-semibold text-fg` ;
  - rôle · ville `text-small text-fg-subtle`.
- **Supprimer les étoiles.** Sous la grille : `mt-6 text-center text-xs text-fg-subtle` « Témoignages illustratifs ».

### 7.10 `Faq` (G) et `data/landing.ts` (G)

- **`Faq`** (section `bg-canvas`) :
  - liste `mx-auto mt-12 max-w-3xl divide-y divide-line border-y border-line` ;
  - `details` en `group py-5` ;
  - `summary` en `flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-base font-medium text-fg ${FOCUS} [&::-webkit-details-marker]:hidden` ;
  - chevron `size-5 shrink-0 text-fg-subtle transition-transform duration-200 group-open:rotate-180` ;
  - réponse `mt-3 pr-10 text-[15px] leading-7 text-fg-muted`.
- **`data/landing.ts` :**

```ts
const NB = " ", MINUS = "−";
export function formatDA(value: number, { signed = false }: { signed?: boolean } = {}) {
  // Formatage manuel (même rendu serveur et navigateur) : espace insécable, vrai signe moins.
  const abs = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return `${value < 0 ? MINUS : signed && value > 0 ? "+" : ""}${abs}${NB}DA`;
}
```

  - Réponse « Quand vais-je recevoir mon argent ? » : « Vos gains validés sont libérés après 3 jours de contrôle. Vous pouvez les retirer dès 2 000 DA vers BaridiMob, CCP ou un compte bancaire (RIB). »
  - `stats` : valeurs avec ` ` (`"12 400+"`, `"3,2 M"`).
  - Le champ `icon` des `steps` peut rester : il n'est plus affiché.
  - `gradient` : conservé, non lu.

### 7.11 `FinalCta`, `Footer`, `app/page.tsx` (G)

- **`FinalCta`** :
  - `relative overflow-hidden rounded-panel bg-night px-6 py-16 text-center sm:px-12 lg:py-20` ;
  - 2 halos `pointer-events-none absolute size-80 rounded-full blur-3xl`, `bg-brand/30` (`-left-20 -top-24`) et `bg-night-income/15` (`-bottom-28 -right-10`) ;
  - `h2` `relative mx-auto max-w-2xl text-h2 text-on-brand lg:text-h1` : « Prêt à faire décoller vos clips&nbsp;? » (**insécable avant « ? »**) ;
  - texte `relative mx-auto mt-4 max-w-xl text-lg leading-8 text-on-brand/80` : « Inscription gratuite, premiers gains dès le premier clip validé. » (**plus de « liste d'attente »**) ;
  - CTA `relative mt-8 flex flex-col justify-center gap-3 sm:flex-row` : `${BTN} ${LG} ${PRIMARY}` « Devenir clipper » + `${BTN} ${LG} ${ON_COLOR_GHOST}` « Lancer une campagne ».
- **`Footer`** :
  - `border-t border-line bg-surface` ;
  - grille `md:grid-cols-[1.5fr_repeat(3,1fr)] gap-10 py-14` ;
  - `<Logo />` + phrase `mt-4 max-w-xs text-small text-fg-muted` ;
  - titres de colonne `text-small font-semibold text-fg` ;
  - liens `text-small text-fg-muted hover:text-fg` ;
  - barre basse `flex flex-col gap-3 border-t border-line py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between` : « © 2026 ClipBoost » et « Fait avec passion en Algérie » + drapeau SVG (`dz-crescent-footer`).
- **`app/page.tsx`** :
  - ordre des sections inchangé ;
  - ajouter un lien d'évitement en premier enfant : `<a href="#contenu" className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-control bg-surface-raised px-4 py-2 text-sm font-medium text-fg shadow-popover transition-transform focus:translate-y-0">Aller au contenu</a>` ;
  - `<main id="contenu">`.

---

## 8. Logo, icônes, emoji, illustrations

**Logo**
- **Symbole :** carré `bg-brand` arrondi (`size-9 rounded-tile`, `size-8 rounded-[10px]` en `sm`) + triangle « play » blanc plein. Identique au favicon.
- **Mot-symbole :** « ClipBoost » en **Plus Jakarta Sans 800**, `tracking-[-0.03em]`, oblique contrôlé par `inline-block -skew-x-6` (pas de faux italique synthétisé).
  - Tailles : 22 px (`md` : landing, auth), 18 px (`sm` : coquille de l'app).
  - Couleurs : `text-fg` sur surface, `text-on-brand` sur `night`.
- **Tag de rôle** (`roleBadge`) à droite du logo pour l'agence et l'admin.
- **Interdits :** ombre colorée sous le symbole, dégradé dans le symbole, wordmark en `font-black italic`.

**Icônes**
- Jeu SVG maison (`icons` de `ui.js`), grille 24, **trait 1,75**, extrémités rondes, `currentColor`.
- **Tailles :**
  - 16 px : boutons `sm`/`md`, badges ;
  - 18 px : navigation ;
  - 20 px : navigation mobile, boutons `lg`.
  - Dans un bouton, c'est le bouton qui fixe la taille (`[&_svg]:size-*`).
- Une icône seule a un `aria-label` sur son bouton ; une icône décorative est en `aria-hidden="true"`.
- **Plateformes :** libellé texte dans un badge neutre, glyphe monochrome toléré à 14 px (`tiktok`, `instagram`, `youtube`). Aucune couleur de marque tierce.

**Emoji : politique stricte**
- **Autorisés :** le visuel choisi par l'agence pour une campagne (`c.emoji`, une donnée), sur la couverture et la vignette.
- **Transformés :** l'emoji d'événement envoyé par le serveur (notifications, activité) devient une icône au trait via `eventIcon()`, dans une pastille `size-8` teintée selon le sens :
  - ✅ succès, 🚫 danger, ⚠️ avertissement ;
  - ⏳ ⚙️ 🎬 🎯 🏁 🏢 🏦 💰 💸 neutres ;
  - repli : `bell`.
- **Interdits :**
  - boutons (« 🎬 », « 🚀 ») ;
  - navigation ;
  - titres (« 👋 ») ;
  - toasts (« ✓ », « 🎉 », « ❤️ ») ;
  - statuts (« ⭐ Top campagne » devient une étoile SVG) ;
  - niveaux (« 🥈 » devient l'icône `medal`) ;
  - états vides (« 🔍 », « 📊 », « 🎯 ») ;
  - étapes du landing, écran d'erreur (« ⚠️ »).
- **Drapeau :** jamais d'emoji, toujours le SVG `flagDz()` ou son équivalent JSX.

**Dégradés et illustrations**
- **Autorisés, et seulement ici :**
  - couvertures `.cover[data-cat]` : 2 arrêts de la même famille de teinte + reflet radial blanc à 24 %, assombries en sombre (`--cover-filter`) ;
  - halos : héros (color-mix 14 %), CTA final et panneau auth (`blur-3xl`, ≤ 30 %).
- **Interdits :** dégradés sur boutons, cartes, texte et barres ; aires en dégradé (lavis plat à 12 %).
- **Pas de photos ni d'illustrations :** le produit est l'illustration. Les maquettes du landing portent le badge « Exemple ».

---

## 9. À faire / À éviter

**À faire**
1. N'écrire que des tokens sémantiques (`bg-surface`, `text-fg-muted`, `border-line`, `bg-brand`, `text-income`…) et lancer le garde-fou du §3.11 avant de rendre un lot.
2. Afficher chaque montant avec `money()`, `bigMoney()`, `da()` ou `daSigned()` : entier, `U+00A0`, « DA » atténué, signe collé, `tabular-nums` et alignement à droite en colonne.
3. Réserver le vert (`income`) à l'argent qui entre chez la personne qui regarde. Une dépense ou un retrait reste en `text-fg`.
4. Garder un seul bouton `primary` par zone visible. L'action globale vit dans la barre latérale, et dans l'en-tête de page seulement sous `lg`.
5. Montrer chaque chiffre clé une seule fois par écran. Les autres endroits y renvoient par un lien.
6. Choisir la forme du graphique selon la donnée : barres pour un flux, ligne cumulée pour un stock. Toujours un total, une échelle, des dates et une table pour lecteur d'écran.
7. Écrire références, comptes et codes en `font-mono`, groupés par 4, avec un bouton Copier ; afficher le net à virer.
8. Accompagner chaque couleur de statut d'un libellé et d'un point ou d'une icône (`STATUS_TONE`).
9. Porter l'état dans l'ARIA (`aria-pressed`, `aria-selected`, `aria-current`, `aria-checked`, `aria-invalid`) et le styler par ces variantes.
10. Dans les formulaires d'argent : unité en suffixe, raccourci de montant, récapitulatif en direct, montant répété sur le bouton de confirmation.
11. Vérifier chaque écran en clair, en sombre, à 390 px et au clavier (focus visible, Échap, tabulation bouclée).
12. Encourager avec des faits (« Plus que 400 vues pour être payé »), jamais avec des confettis ni des emoji.

**À éviter**
1. `gray-*`, `ink`, `white`, `black`, couleurs Tailwind de statut (`emerald`, `amber`, `rose`, `sky`…) et hex dans les templates : rien de tout cela ne bascule en sombre.
2. Les variantes `dark:` dans les templates (sauf l'icône du thème).
3. Un `extra` qui redéfinit une propriété de la recette (`absolute` sur un `iconBtn`, `hidden` sur un `btn`, `px-0` sur un bouton) : envelopper plutôt.
4. Les emoji d'interface et le drapeau en emoji.
5. Une courbe lissée sur une série quotidienne, un graphique sans échelle, un nombre sur chaque barre, deux axes Y.
6. Du rouge ou du rose pour une file d'attente normale, un compteur de navigation ou un retrait.
7. Les ombres colorées, les dégradés sur boutons ou cartes, et les halos hors des 3 emplacements prévus.
8. `hover:-translate-y-*` et les animations de plus de 300 ms.
9. Des chiffres inventés présentés comme réels (solde sur l'écran de connexion, captures sans « Exemple », étoiles sur des témoignages fictifs).
10. `rounded-3xl` ou `rounded-[2rem]` sur des conteneurs de données, et une carte dans une carte dans une carte.
11. Du texte sous 4,5:1 : pas plus pâle que `text-fg-subtle` sur surface, `text-on-brand/90` sur violet, `text-on-brand/65` sur `night`.
12. Des chiffres en Plus Jakarta Sans : les montants, KPI et axes restent en Geist.
13. Redéclarer au niveau supérieur un nom d'un autre fichier `web/src/*.js` (SyntaxError dans le bundle concaténé).
