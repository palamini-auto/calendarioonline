# Calendario Officina

Frontend statico (`public/`) + Cloudflare Pages Functions (`functions/`) che leggono/scrivono
il foglio `CALENDARIO` direttamente con Google Sheets API. Nessun GAS.

```
public/index.html            → la pagina
functions/api/dati.js        → GET  /api/dati
functions/api/scrivi.js      → POST /api/scrivi
functions/_lib/google.js     → auth service account + helper Sheets API
```

## Setup (una volta sola)

1. **Google**: il foglio deve essere condiviso (Editor) con l'email del service account.
   L'API "Google Sheets API" deve essere abilitata nel progetto Cloud.
2. **GitHub**: crea la repo e fai push di questa cartella.
3. **Cloudflare Pages**: Create project → Connect to Git → scegli la repo.
   - Framework preset: `None`
   - Build command: *(vuoto)*
   - Build output directory: `public`
4. **Variabili** (Settings → Variables and Secrets, come *Secret*):
   - `GOOGLE_SA_EMAIL` = `client_email` del JSON del service account
   - `GOOGLE_SA_KEY`   = `private_key` del JSON (con i `\n`, va bene incollata così)
   - `SHEET_ID` *(opzionale)* = ID del foglio (altrimenti usa quello in `google.js`)
5. Fai un nuovo deploy dopo aver messo le variabili.

## Sicurezza

Gli endpoint `/api/*` sono aperti a chi conosce l'URL (come era il GAS pubblico).
Per chiuderli: Cloudflare Zero Trust → Access → Applications → aggiungi l'app Pages
(o il dominio custom) con una policy sulle vostre email.
