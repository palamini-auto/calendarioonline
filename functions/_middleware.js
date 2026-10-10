import { json } from "./_lib/google.js";

// Protezione del calendario (11/10): le API /api/dati e /api/scrivi rispondono solo a chi manda la
// chiave segreta nell'intestazione X-Chiave. La chiave la conosce solo l'estensione PALAMINIAUTO,
// che la passa alla pagina nell'indirizzo (#k=…). Chi apre il link senza estensione non vede niente.
//
// Variabile su Cloudflare (Settings → Variables and Secrets): CALENDARIO_CHIAVE (tipo Secret).
// Finché non è impostata il calendario resta aperto come prima (così si può pubblicare prima).
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return next();
  const chiave = env.CALENDARIO_CHIAVE;
  if (!chiave) return next();
  if (request.headers.get("X-Chiave") !== chiave) {
    return json({ errore: "Accesso non autorizzato: il calendario si apre solo dall'app con l'estensione PALAMINIAUTO." }, 401);
  }
  return next();
}
