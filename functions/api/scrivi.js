import { sheets, json } from "../_lib/google.js";

// POST /api/scrivi   body JSON: { data, ora, tecnico, valore, riga }
// `riga` è il numero di riga nel foglio (suggerimento del client, arriva da /api/dati).
// Prima si verifica con una lettura minuscola (A:B di quella sola riga) che data e ora
// corrispondano ancora; se qualcuno ha inserito/spostato righe, si cerca la riga giusta.
// Poi UNA sola scrittura sulla singola cella.

const COL = { ANDREA: "C", MATTEO: "D", SARA: "E", PANDA: "F", CLIO: "G" };
const norm = (s) => String(s ?? "").trim();
const enc = encodeURIComponent;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const data = norm(body.data);
    const ora = norm(body.ora);
    const col = COL[norm(body.tecnico).toUpperCase()];
    const valore = String(body.valore ?? "");
    let riga = parseInt(body.riga, 10) || 0;

    if (!data || !ora || !col) {
      return json({ success: false, errore: "Parametri non validi" }, 400);
    }

    // 1) verifica del suggerimento di riga
    let ok = false;
    if (riga > 1) {
      const chk = await sheets(
        env,
        `/values/${enc(`CALENDARIO!A${riga}:B${riga}`)}?valueRenderOption=FORMATTED_VALUE`
      );
      const v = (chk.values && chk.values[0]) || [];
      ok = norm(v[0]) === data && norm(v[1]) === ora;
    }

    // 2) fallback: cerca la riga leggendo solo le colonne A:B
    if (!ok) {
      const all = await sheets(
        env,
        `/values/${enc("CALENDARIO!A:B")}?valueRenderOption=FORMATTED_VALUE`
      );
      const values = all.values || [];
      riga = 0;
      for (let i = 1; i < values.length; i++) {
        if (norm(values[i][0]) === data && norm(values[i][1]) === ora) {
          riga = i + 1;
          break;
        }
      }
      if (!riga) return json({ success: false, errore: "Riga non trovata" }, 404);
    }

    // 3) scrittura della singola cella (USER_ENTERED = stesso comportamento di setValue)
    await sheets(
      env,
      `/values/${enc(`CALENDARIO!${col}${riga}`)}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [[valore]] }) }
    );

    return json({ success: true, riga });
  } catch (e) {
    return json({ success: false, errore: String(e.message || e) }, 500);
  }
}
