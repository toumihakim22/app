// Script exécuté avant l'affichage pour appliquer le thème sans flash : choix mémorisé (clair ou sombre),
// sinon préférence du système. La couleur de la barre du navigateur mobile (meta theme-color) suit le thème.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("clipboost-theme");var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"#0b0d12":"#f5f6f8")}catch(e){}})();`;
