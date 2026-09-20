import { sheets, json } from "../_lib/google.js";

// GET /api/dati
// Restituisce tutte le righe del foglio CALENDARIO in formato compatto:
//   { righe: [[data, ora, ANDREA, MATTEO, SARA, PANDA, CLIO, numeroRigaFoglio], ...] }
// Il numero di riga serve al client per scrivere poi con una sola chiamata.
export async function onRequestGet({ env }) {
  try {
    const range = encodeURIComponent("CALENDARIO!A:G");
    const res = await sheets(
      env,
      `/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`
    );

    const values = res.values || [];
    const righe = [];

    // riga 1 = intestazione
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      const data = String(r[0] ?? "").trim();
      const ora = String(r[1] ?? "").trim();
      if (!data || !ora) continue;
      righe.push([
        data,
        ora,
        r[2] ?? "",
        r[3] ?? "",
        r[4] ?? "",
        r[5] ?? "",
        r[6] ?? "",
        i + 1, // numero di riga reale nel foglio (1-based)
      ]);
    }

    return json({ righe });
  } catch (e) {
    return json({ errore: String(e.message || e) }, 500);
  }
}
