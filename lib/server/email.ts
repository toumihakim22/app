// Envoi d'emails via l'API Resend si RESEND_API_KEY est défini ; sinon, l'email est affiché
// dans la console du serveur (développement).
export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] À : ${to}\n[email] Objet : ${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "ClipBoost <no-reply@clipboost.dz>", to, subject, text }),
  });
  if (!res.ok) throw new Error(`Échec de l'envoi de l'email (${res.status})`);
}
