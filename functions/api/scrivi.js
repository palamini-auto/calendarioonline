import { sheets, json } from "../_lib/google.js";

// POST /api/scrivi
//   singola cella: { data, ora, tecnico, valore, riga }
//   più celle:     { data, tecnico, valore, celle: [{ ora, riga }, ...] }
//
// `riga` è il numero di riga nel foglio (suggerimento del client, arriva da /api/dati).
// Prima si verifica con UNA lettura piccola (solo A:B delle righe interessate) che data e ora
// corrispondano ancora; se qualcuno ha inserito/spostato righe, si cercano le righe giuste.
// Poi UNA sola scrittura (values:batchUpdate) per tutte le celle.

const COL = { ANDREA: "C", MATTEO: "D", SARA: "E", PANDA: "F", CLIO: "G" };
const norm = (s) => String(s ?? "").trim();
const enc = encodeURIComponent;
const MAX_CELLE = 100;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const data = norm(body.data);
    const col = COL[norm(body.tecnico).toUpperCase()];
    const valore = String(body.valore ?? "");

    const celle = (Array.isArray(body.celle) ? body.celle : [{ ora: body.ora, riga: body.riga }]).map(
      (c) => ({ ora: norm(c.ora), riga: parseInt(c.riga, 10) || 0 })
    );

    if (!data || !col || !celle.length || celle.length > MAX_CELLE || celle.some((c) => !c.ora)) {
      return json({ success: false, errore: "Parametri non validi" }, 400);
    }

    // 1) verifica dei suggerimenti di riga (una sola lettura sul blocco di righe interessato)
    let ok = false;
    if (celle.every((c) => c.riga > 1)) {
      const righe = celle.map((c) => c.riga);
      const min = Math.min(...righe);
      const max = Math.max(...righe);
      if (max - min <= 400) {
        const chk = await sheets(
          env,
          `/values/${enc(`CALENDARIO!A${min}:B${max}`)}?valueRenderOption=FORMATTED_VALUE`
        );
        const v = chk.values || [];
        ok = celle.every((c) => {
          const r = v[c.riga - min] || [];
          return norm(r[0]) === data && norm(r[1]) === c.ora;
        });
      }
    }

    // 2) fallback: cerca le righe leggendo solo le colonne A:B
    if (!ok) {
      const all = await sheets(
        env,
        `/values/${enc("CALENDARIO!A:B")}?valueRenderOption=FORMATTED_VALUE`
      );
      const values = all.values || [];
      const perOra = {};
      for (let i = 1; i < values.length; i++) {
        if (norm(values[i][0]) === data) {
          const o = norm(values[i][1]);
          if (!(o in perOra)) perOra[o] = i + 1; // prima occorrenza, come nel GAS originale
        }
      }
      for (const c of celle) {
        c.riga = perOra[c.ora] || 0;
        if (!c.riga) return json({ success: false, errore: `Riga non trovata (${data} ${c.ora})` }, 404);
      }
    }

    // 3) scrittura (USER_ENTERED = stesso comportamento di setValue)
    await sheets(env, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: celle.map((c) => ({
          range: `CALENDARIO!${col}${c.riga}`,
          values: [[valore]],
        })),
      }),
    });

    return json({ success: true, celle });
  } catch (e) {
    return json({ success: false, errore: String(e.message || e) }, 500);
  }
}
