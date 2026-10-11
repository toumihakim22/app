# ClipBoost — tableau de bord Clipper

Maquette frontend interactive en français avec Next.js App Router, TypeScript et Tailwind CSS. Tous les chiffres, profils et campagnes sont fictifs. Aucun backend, paiement, connexion ou stockage persistant n'est intégré.

## Prérequis
- Node.js 20.9 ou plus récent
- npm
- Claude Code installé et connecté si vous souhaitez le faire évoluer avec Claude Code

## Lancer le projet
```bash
npm install
npm run dev
```
Ouvrir http://localhost:3000

## Vérifier la compilation
```bash
npm run build
```

## Utiliser avec Claude Code
Depuis le dossier du projet, lancez :
```bash
claude
```
Puis donnez-lui une tâche précise, par exemple :
> Lis le README et le code existant. Améliore le tableau de bord Clipper sans ajouter de backend ni de paiement. Garde l'interface en français, responsive, accessible et basée sur des données fictives. Avant de modifier, explique brièvement ton plan. Après les changements, lance npm run build et corrige les erreurs.

## Fonctionnalités présentes
- Menu latéral responsive avec navigation simulée
- Cartes de statistiques
- Mini graphique de vues sans bibliothèque externe
- Campagnes recommandées et catalogue filtrable par texte/catégorie
- Favoris de campagne (état local React)
- Notifications simulées
- Pages de démonstration pour publications, portefeuille, statistiques, profil et paramètres
- Messages d'avertissement sur le caractère fictif des données
