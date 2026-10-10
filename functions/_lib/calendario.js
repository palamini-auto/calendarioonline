import { sheets } from "./google.js";

// Le colonne del CALENDARIO si cercano per intestazione, non per posizione:
// funziona col foglio di oggi (DATA, ORARIO, ANDREA, MATTEO, SARA, PANDA, CLIO)
// e anche dopo la migrazione (ID in colonna A, TECNICO 1/2/3, AUTO 1/2).
// Il sito continua a usare i nomi ANDREA/MATTEO/SARA/PANDA/CLIO.
const NOMI = {
  DATA: ["DATA"],
  ORARIO: ["ORARIO"],
  ANDREA: ["ANDREA", "TECNICO 1"],
  MATTEO: ["MATTEO", "TECNICO 2"],
  SARA: ["SARA", "TECNICO 3"],
  PANDA: ["PANDA", "AUTO 1"],
  CLIO: ["CLIO", "AUTO 2"],
};
const CAMPI = Object.keys(NOMI);
const DURATA_CACHE = 10 * 60 * 1000;

// Le intestazioni restano in cache finché l'isolate del Worker è vivo (max 10 minuti)
let cache = { col: null, exp: 0 };

// indice 0-based -> lettera di colonna ("A", "B", ... "AA")
export function lettera(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// { DATA: 1, ORARIO: 2, ANDREA: 3, ..., ultima: 7 } = indici 0-based delle colonne nel foglio.
// forza = true rilegge le intestazioni (es. se una verifica fallisce dopo che le colonne sono state spostate)
export async function colonne(env, forza = false) {
  const ora = Date.now();
  if (!forza && cache.col && cache.exp > ora) return cache.col;
  const res = await sheets(env, `/values/${encodeURIComponent("CALENDARIO!1:1")}?valueRenderOption=FORMATTED_VALUE`);
  const titoli = ((res.values || [])[0] || []).map((t) => String(t).trim().toUpperCase());
  const col = {};
  for (const k of CAMPI) {
    const i = titoli.findIndex((t) => NOMI[k].includes(t));
    if (i < 0) throw new Error(`Colonna ${k} non trovata nel CALENDARIO`);
    col[k] = i;
  }
  // ID della riga (data+ora, es. 202611190840): facoltativo, c'è solo dopo la migrazione.
  // Serve al calendario incorporato nell'app per aprire la riga giusta.
  col.ID = titoli.indexOf("ID");
  col.ultima = Math.max(col.ID, ...CAMPI.map((k) => col[k]));
  cache = { col, exp: ora + DURATA_CACHE };
  return col;
}
