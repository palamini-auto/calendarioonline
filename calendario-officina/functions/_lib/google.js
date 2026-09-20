// Helper condiviso: autenticazione service account (JWT RS256 via Web Crypto)
// e wrapper per Google Sheets API v4.
//
// Variabili d'ambiente (Cloudflare Pages → Settings → Variables and Secrets):
//   GOOGLE_SA_EMAIL  → client_email del service account
//   GOOGLE_SA_KEY    → private_key del service account (incolla il valore del JSON, anche con i \n)
//   SHEET_ID         → (opzionale) ID del foglio, altrimenti usa quello sotto

const SHEET_ID_DEFAULT = "1_Kkvn4ziKQE_qKakv_pH_pnfkWTMvTB618S1f0onA2g";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Il token resta in cache finché l'isolate del Worker è vivo (~1 ora di validità)
let cache = { token: null, exp: 0 };

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(env, forceRefresh = false) {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cache.token && cache.exp - 60 > now) return cache.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_SA_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claim));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_SA_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + "." + b64url(sig);

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Auth Google fallita: " + (j.error_description || j.error || r.status));

  cache = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return cache.token;
}

// Chiamata generica a Sheets API. `path` è tipo "/values/CALENDARIO!A:G?..."
export async function sheets(env, path, init = {}) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID || SHEET_ID_DEFAULT}`;

  async function call(token) {
    return fetch(base + path, {
      ...init,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  }

  let r = await call(await getAccessToken(env));
  if (r.status === 401) r = await call(await getAccessToken(env, true)); // token scaduto → riprova una volta

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "Sheets API " + r.status);
  return j;
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
