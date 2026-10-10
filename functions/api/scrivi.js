import { sheets, json } from "../_lib/google.js";
import { colonne, lettera } from "../_lib/calendario.js";

// POST /api/scrivi
//   singola cella: { data, ora, tecnico, valore, riga }
//   più celle:     { data, tecnico, valore, celle: [{ ora, riga }, ...] }
//
// `riga` è il numero di riga nel foglio (suggerimento del client, arriva da /api/dati).
// Prima si verifica con UNA lettura piccola (solo le righe interessate) che data e ora
// corrispondano ancora; se qualcuno ha inserito/spostato righe, si cercano le righe giuste.
// `prima` (facoltativo) è il valore che il client vedeva nella cella: se nel frattempo
// qualcuno l'ha cambiato (bot dell'app, sito, altro PC) non si scrive e si risponde 409.
// Poi UNA sola scrittura (values:batchUpdate) per tutte le celle.
// Le colonne si trovano per intestazione (vedi _lib/calendario.js).

const TECNICI = ["ANDREA", "MATTEO", "SARA", "PANDA", "CLIO"];
const norm = (s) => String(s ?? "").trim();
const enc = encodeURIComponent;
const MAX_CELLE = 100;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const data = norm(body.data);
    const tecnico = norm(body.tecnico).toUpperCase();
    const valore = String(body.valore ?? "");

    const celle = (Array.isArray(body.celle) ? body.celle : [{ ora: body.ora, riga: body.riga, prima: body.prima }]).map(
      (c) => ({ ora: norm(c.ora), riga: parseInt(c.riga, 10) || 0, prima: c.prima === undefined ? undefined : norm(c.prima) })
    );
    const attuale = {}; // riga -> valore attuale della cella da scrivere

    if (!data || !TECNICI.includes(tecnico) || !celle.length || celle.length > MAX_CELLE || celle.some((c) => !c.ora)) {
      return json({ success: false, errore: "Parametri non validi" }, 400);
    }

    let C = await colonne(env);
    let ultima = lettera(C.ultima);

    // 1) verifica dei suggerimenti di riga (una sola lettura sul blocco di righe interessato)
    let ok = false;
    if (celle.every((c) => c.riga > 1)) {
      const righe = celle.map((c) => c.riga);
      const min = Math.min(...righe);
      const max = Math.max(...righe);
      if (max - min <= 400) {
        const chk = await sheets(
          env,
          `/values/${enc(`CALENDARIO!A${min}:${ultima}${max}`)}?valueRenderOption=FORMATTED_VALUE`
        );
        const v = chk.values || [];
        ok = celle.every((c) => {
          const r = v[c.riga - min] || [];
          attuale[c.riga] = norm(r[C[tecnico]]);
          return norm(r[C.DATA]) === data && norm(r[C.ORARIO]) === c.ora;
        });
      }
    }

    // 2) fallback: rilegge le intestazioni (le colonne potrebbero essere state spostate) e cerca le righe
    if (!ok) {
      C = await colonne(env, true);
      ultima = lettera(C.ultima);
      const all = await sheets(
        env,
        `/values/${enc(`CALENDARIO!A:${ultima}`)}?valueRenderOption=FORMATTED_VALUE`
      );
      const values = all.values || [];
      const perOra = {};
      for (let i = 1; i < values.length; i++) {
        if (norm(values[i][C.DATA]) === data) {
          const o = norm(values[i][C.ORARIO]);
          if (!(o in perOra)) perOra[o] = i + 1; // prima occorrenza, come nel GAS originale
        }
      }
      for (const c of celle) {
        c.riga = perOra[c.ora] || 0;
        if (!c.riga) return json({ success: false, errore: `Riga non trovata (${data} ${c.ora})` }, 404);
        attuale[c.riga] = norm((values[c.riga - 1] || [])[C[tecnico]]);
      }
    }

    // 3) nessuno deve aver cambiato la cella dopo che il client l'ha letta
    const cambiate = celle.filter((c) => c.prima !== undefined && attuale[c.riga] !== c.prima);
    if (cambiate.length) {
      const c = cambiate[0];
      return json({
        success: false,
        conflitto: true,
        errore: `Nel frattempo la cella delle ${c.ora} è cambiata (ora c'è: "${attuale[c.riga] || "vuota"}"). Ricarico il calendario: controlla e riprova.`,
      }, 409);
    }

    // 4) scrittura (USER_ENTERED = stesso comportamento di setValue)
    await sheets(env, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: celle.map((c) => ({
          range: `CALENDARIO!${lettera(C[tecnico])}${c.riga}`,
          values: [[valore]],
        })),
      }),
    });

    return json({ success: true, celle });
  } catch (e) {
    return json({ success: false, errore: String(e.message || e) }, 500);
  }
}
