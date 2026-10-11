// Script exécuté avant l'affichage pour appliquer le thème sans flash :
// choix mémorisé, sinon préférence du système.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("clipboost-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})();`;
