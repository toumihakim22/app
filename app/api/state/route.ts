import { route, json } from "@/lib/server/http";
import { currentUser } from "@/lib/server/auth";
import { publicState, stateFor } from "@/lib/server/services/state";

export const dynamic = "force-dynamic";

// Données de l'utilisateur connecté, ou données publiques si personne n'est connecté.
export const GET = route(async () => {
  const user = await currentUser();
  if (!user || (user.status === "Suspendu" && user.role !== "admin")) return json({ user: null, public: await publicState() });
  return json({ user: user.id, ...(await stateFor(user)) });
});
