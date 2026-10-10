import { sheets, json } from "../_lib/google.js";
import { colonne, lettera } from "../_lib/calendario.js";

// GET /api/dati
// Restituisce tutte le righe del foglio CALENDARIO in formato compatto:
//   { righe: [[data, ora, ANDREA, MATTEO, SARA, PANDA, CLIO, numeroRigaFoglio, ID], ...] }
// Il numero di riga serve al client per scrivere poi con una sola chiamata.
// Le colonne si trovano per intestazione (vedi _lib/calendario.js).
export async function onRequestGet({ env }) {
  try {
    const col = await colonne(env);
    const range = encodeURIComponent(`CALENDARIO!A:${lettera(col.ultima)}`);
    const res = await sheets(
      env,
      `/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`
    );

    const values = res.values || [];
    const righe = [];

    // riga 1 = intestazione
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      const data = String(r[col.DATA] ?? "").trim();
      const ora = String(r[col.ORARIO] ?? "").trim();
      if (!data || !ora) continue;
      righe.push([
        data,
        ora,
        r[col.ANDREA] ?? "",
        r[col.MATTEO] ?? "",
        r[col.SARA] ?? "",
        r[col.PANDA] ?? "",
        r[col.CLIO] ?? "",
        i + 1, // numero di riga reale nel foglio (1-based)
        col.ID >= 0 ? String(r[col.ID] ?? "").trim() : "", // ID fisso della riga (vuoto prima della migrazione)
      ]);
    }

    return json({ righe });
  } catch (e) {
    return json({ errore: String(e.message || e) }, 500);
  }
}
