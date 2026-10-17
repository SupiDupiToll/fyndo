# Fyndo

Fyndo ist ein smarter Online-Marktplatz, auf dem Händler Produkte verkaufen und Kundinnen eine zentrale Einkaufsseite für alles, was sie suchen, finden. Neben klassischen Produkten unterstützt Fyndo **Gutscheine**, **Geschenkkarten**, **Drittshop-Bestellungen** (Concierge) und ein integriertes **POS-System** (Kasse im Geschäft).

## Features

- **Marktplatz** – Übersicht aller aktiven Produkte inkl. Varianten, Preisen und Verkäufer-Profilseiten.
- **Checkout & Zahlung** – Vollständiger Kaufprozess mit Zahlung über **RBank** (gehosteter Redirect / eingebettetes Checkout) und Rabattlogik.
- **Gutscheine (Voucher)** – Produkte können als Gutscheine angelegt werden: feste Beträge oder Betragsränge (`min/max/step`), Rabatte als Festbetrag oder Prozent, Einlösung per Gutschein-Link.
- **Geschenkkarten (Gift Cards)** – Käufliche Fyndo-Gutscheine mit Betrag und persönlicher Nachricht; Status-Lebenszyklus `PENDING → ACTIVE → REDEEMED/EXPIRED`, einsetzbar als Zahlungsmittel im Checkout und POS.
- **Concierge / Drittshop-Bestellungen** – Bestellung eines beliebigen Produkts aus einem externen Shop per URL. Die App ruft die Shop-Metadaten (Name, Favicon, Host) ab und wickelt Anfrage → Angebot → Bestellung → Erfüllung ab.
- **POS-System** – Kassensystem pro Verkäufer: Kiosk-Modus, Bestellgruppen, Nummern-Karten, Lock-Screen, Containers & Toppings, Varianten, Audio-Ansagen (Speech), Zahlungsarten (RBank, QR/Tippie, Terminal, Bar, Gutschein).
- **POS-Bestellübersicht (Board)** – McDonald's-ähnlicher Vollbild-Bildschirm unter `/pos/[vendor]/board`: links „In Bearbeitung", rechts „Zur Abholung bereit". Es werden nur **bezahlte** Bestellungen angezeigt (unbezahlte werden ausgeblendet), dargestellt als große **Bestellnummern** ohne Artikel-Details. Neue Bestellungen ploppen groß auf und wandern klein in die linke Spalte; beim Wechsel auf „Ausgeführt" kommt erneut ein großes Pop-up („Zur Abholung bereit"), die Nummer fliegt nach rechts und verschwindet nach **10 Minuten** (Countdown + Fortschrittsbalken) automatisch. Öffnen lässt sich das Board über den Button „Bestellübersicht" im POS-Admin-Bereich.
- **Bon-Drucker** – Nach bestätigter POS-Zahlung druckt das POS automatisch einen Kassenbon an einen USB-Thermodrucker (ESC/POS, **Autocut**): Bestellnummer groß oben, Positionen, Zusammenfassung, Zahlungsart. Der Druck läuft über den kleinen lokalen Druckserver unter [`printer/`](printer/README.md); die Verbindung lässt sich im POS-Debug-Menü konfigurieren und testen.
- **Bon-Designer** – Eigenständiges HTML-Werkzeug ([`printer/bon-designer.html`](printer/bon-designer.html), keine fyndo-Integration), um Bons visuell zu gestalten und zu drucken: Text, 2 Spalten, Trenner, **QR-Codes**, **Barcodes**, Vorlagen, Live-Vorschau, JSON-Export/Import.
- **Admin-Bereich** – Verwaltung von Verkäufern, Produkten, Concierge-Bestellungen, Auszahlungsanträgen und Einstellungen.
- **Benachrichtigungen** – Push-Benachrichtigungen über **ntfy.sh** bei bezahlten Bestellungen, Drittshop-Anfragen und POS-Zahlungen.
- **Demo-Modus** – Vorschau der App unter `/demos` mit Beispieldaten und ohne echtes Checkout: Fyndo-Marktplatz (inkl. Admin), Fyndo-POS und die **Bestellübersicht** unter `/demos/pos-board` (Live-Simulation mit verkürzter Abholzeit, damit der komplette Zyklus sofort sichtbar ist). Bestellungen, die im POS-Kiosk-Demo aufgegeben werden, erscheinen automatisch auf dem Demo-Board (am besten in zwei Tabs nebeneinander öffnen). Ein Umschalter ganz oben wechselt zwischen den Bereichen; die Seiten sind nur anschaubar, alle Aktionen sind deaktiviert.

## Tech-Stack

- **Next.js 16** (App Router, Server Components) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + PostCSS
- **Prisma 7** mit **Neon** (PostgreSQL, serverless)
- **Cloudflare Workers** als Deployment-Ziel (über **`@opennextjs/cloudflare`**, Node.js-Runtime mit `nodejs_compat`)
- **Hexclave (Next)** für Authentifizierung und Sessions
- **RBank** als Zahlungsdienstleister (Server-to-Server API)
- **ntfy.sh** für Push-Benachrichtigungen
- **motion** für Animationen, **qrcode** für QR-Codes, **lucide-react** für Icons

## Voraussetzungen

- Node.js 20+
- pnpm (Projekt nutzt eine pnpm-Workspace-Datei; `npm`-Lockfile ist zusätzlich vorhanden)
- Eine PostgreSQL-Datenbank (z. B. Neon), ein Hexclave-Projekt sowie RBank-Zugangsdaten

## Installation

```bash
# Abhängigkeiten installieren (führt per postinstall auch "prisma generate" aus)
pnpm install

# Umgebungsvariablen anlegen
cp .env.example .env   # siehe Abschnitt "Umgebungsvariablen"

# Datenbank-Migrationen anwenden
npx prisma migrate deploy

# Entwicklungsserver starten
pnpm dev
```

Der Server läuft anschließend unter `http://localhost:3000`.

## Umgebungsvariablen

Kopiere `.env.example` zu `.env` und fülle die Werte aus. Die `.env` ist per `.gitignore` vom Repository ausgeschlossen.

| Variable | Beschreibung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL (z. B. Neon, mit `sslmode=require`) |
| `APP_URL` | Öffentliche Basis-URL der App (z. B. `https://fyndo.sdtoll.de`) |
| `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID` | Hexclave-Projekt-ID (Auth) |
| `HEXCLAVE_SECRET_SERVER_KEY` | Geheimer Server-Schlüssel von Hexclave |
| `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` | Öffentlicher Client-Key für die Auth-UI |
| `HEXCLAVE_ADMIN_EMAILS` | Kommagetrennte Liste von E-Mails mit `SUPER_ADMIN`-Rolle |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Admin-E-Mail (Fallback für die Admin-Erkennung) |
| `RBANK_API_URL` | Basis-URL der RBank-API (z. B. `https://rbank.sdtoll.de`) |
| `RBANK_MERCHANT_ID` | RBank-Merchant-ID |
| `RBANK_MERCHANT_SECRET` | RBank-Merchant-Secret |
| `RBANK_EMBED_CHECKOUT_KEY` | Key für das eingebettete RBank-Checkout |
| `NTFY_WEBHOOK_URL` | ntfy.sh-Webhook-URL für Bestell-Benachrichtigungen |
| `TIPPIE_PAY_BASE` | Basis-URL für Tippie-Pay-Transaktionen (QR-Codes im POS) |
| `POS_CARD_SECRET` | Secret für die POS-Zugangskarten |
| `NEXT_PUBLIC_POS_PRINT_URL` | Adresse des Bon-Druckservers, die der Browser des Tablets direkt aufruft (leer = `http://localhost:8787`; im POS-Debug-Menü änderbar) |

## Skripte

| Befehl | Beschreibung |
| --- | --- |
| `pnpm dev` | Next.js-Entwicklungsserver |
| `pnpm build` | Produktions-Build (Next.js) |
| `pnpm start` | Produktionsserver starten (klassisches Node-Hosting) |
| `pnpm preview` | Build für Cloudflare + lokaler Worker (`wrangler dev`) |
| `pnpm deploy` | Build + Deployment als Cloudflare Worker |
| `pnpm upload` | Build + Upload als Cloudflare-Worker-Version (ohne Deploy) |
| `pnpm cf-typegen` | Cloudflare-Bindungstypen generieren (`cloudflare-env.d.ts`) |
| `pnpm postinstall` | Wird automatisch ausgeführt; generiert den Prisma-Client |

## Projektstruktur

```
prisma/                     Prisma-Schema und Migrationen
printer/                    Lokaler Bon-Druckserver (ESC/POS → USB-Thermodrucker)
src/app/
  (main)/                    Öffentliche Seiten (Marktplatz, Checkout, Bestellungen,
                             Gutscheine, Concierge, Admin, POS, Verkäufer)
  api/                       Route-Handler (checkout, gift-cards, pos, products,
                             rabatt, third-party-orders, user, admin)
  demos/                     Demo-Modus (Marktplatz + POS, nur Beispieldaten)
  gate/                      Gate-Seite (z. B. POS-Eingang)
  handler/                   Hexclave-Auth-Handler (sign-in/sign-up)
  pos/[vendor]/              POS-Seite pro Verkäufer (Kiosk + Bestellübersicht/Board)
src/components/              UI-Komponenten (Nav, Footer, POS-Kiosk, Picker, ...)
src/generated/prisma/        Generierter Prisma-Client (Runtime `cloudflare`)
src/hexclave/                Hexclave-Server-App-Setup
src/lib/                     Business-Logik (auth, checkout, env, gift-card, ntfy,
                             pos, rbank, shop, third-party-order, vendor, ...)
public/pos-audio/            POS-Ansage-MP3s (nur über /api/pos/audio erreichbar)
wrangler.jsonc               Cloudflare-Worker-Konfiguration
open-next.config.ts          OpenNext-Cloudflare-Konfiguration
```

### Domain-Modell (Kurzübersicht)

- **User** – `SUPER_ADMIN`, `SELLER` oder `USER`; Verkäufer haben Name, Guthaben und POS-Einstellungen.
- **Product** – Produkt oder `VOUCHER`; optional mit Varianten, Containern/Toppings, POS-Sichtbarkeit und Rabatt-Konfiguration.
- **Order** – Kauf eines Produkts inkl. Zahlungsstatus (`PENDING → PAID → DONE/CANCELLED`), POS-Zuordnung und Gutschein-Einlösung.
- **GiftCard** – Fyndo-Gutschein mit Code, Restguthaben und Status-Lebenszyklus.
- **ThirdPartyOrder** – Drittshop-Bestellung mit eigenem Status-Workflow (`REQUESTED → QUOTED → ORDERED → DONE/CANCELLED`).
- **PosNumberCard** – Nummern-Karten pro Verkäufer für den POS-Betrieb.

## Datenbank

Migrationen liegen unter `prisma/migrations/`. Änderungen am Schema:

```bash
npx prisma migrate dev --name <beschreibung>
```

Der Prisma-Client wird nach `src/generated/prisma` generiert und wird durch `postinstall` bei jedem `install` aktualisiert. Der Generator nutzt `runtime = "cloudflare"` (siehe `prisma/schema.prisma`), damit der WASM-Query-Compiler im Workers-Bundle funktioniert.

## Deployment auf Cloudflare Workers

Die App läuft als **Cloudflare Worker** über den Adapter [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Die Node.js-Runtime von Next.js wird dabei über die `nodejs_compat`-Kompatibilitätsschicht von Workers ausgeführt; die Konfiguration liegt in [`wrangler.jsonc`](wrangler.jsonc) und [`open-next.config.ts`](open-next.config.ts).

```bash
# 1. Lokal wie im Worker testen (baut und startet `wrangler dev`)
pnpm preview

# 2. In Produktion deployen (baut und lädt hoch)
pnpm deploy
```

### Umgebungsvariablen auf Cloudflare

Es gibt zwei Kategorien:

- **Build-Zeit** (`NEXT_PUBLIC_*`): werden von Next.js in das Bundle eingebettet und müssen beim **Build** verfügbar sein – also in den Build-Variablen der CI bzw. in der lokalen `.env`/`.env.production`. Dazu gehören `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL` und `NEXT_PUBLIC_POS_PRINT_URL`.
- **Laufzeit (Secrets)**: alles andere. Diese werden über das Cloudflare-Dashboard bzw. per CLI gesetzt und landen dank `nodejs_compat` in `process.env`:

  ```bash
  npx wrangler secret put DATABASE_URL
  npx wrangler secret put HEXCLAVE_PROJECT_ID
  npx wrangler secret put HEXCLAVE_PUBLISHABLE_CLIENT_KEY
  npx wrangler secret put HEXCLAVE_SECRET_SERVER_KEY
  npx wrangler secret put APP_URL
  # optional: RBANK_*, NTFY_WEBHOOK_URL, POS_CARD_SECRET, TIPPIE_PAY_BASE, HEXCLAVE_ADMIN_EMAILS
  ```

  > **Pflicht:** Ohne `HEXCLAVE_PROJECT_ID` (und den passenden Hexclave-Keys) bricht der Server beim ersten Request mit `500` ab (`It seems that you haven't provided a project ID.`). Die App liest die Hexclave-Werte zur Laufzeit über die `HEXCLAVE_*`-Namen; die `NEXT_PUBLIC_*`-Namen aus der Tabelle oben sind die Build-Zeit-Entsprechungen, aus denen das SDK automatisch zurückfällt.

Für die lokale Entwicklung mit `wrangler dev`/`pnpm preview` die Secrets in eine `.dev.vars` legen (Vorlage: [`.dev.vars.example`](.dev.vars.example)); `pnpm dev` liest sie weiterhin aus `.env`.

> **Wichtig:** Die Anwendung liest Laufzeit-Secrets zur Laufzeit aus `process.env`. `DATABASE_URL` muss also zusätzlich zu den Build-Variablen auch als Laufzeit-Secret gesetzt sein.

### Bindungs-Typen (`pnpm cf-typegen`)

`pnpm cf-typegen` erzeugt [`cloudflare-env.d.ts`](cloudflare-env.d.ts) aus `wrangler.jsonc`. Der Befehl nutzt bewusst `--include-runtime false`: Die von Wrangler sonst mitgelieferten Workers-Runtime-Typen überschreiben DOM-Signaturen wie `Response.json()` (dort `Promise<unknown>` statt `Promise<any>`) und lassen `next build` an den vielen untypisierten `r.json()`-Aufrufen der App scheitern. Die Bindungstypen selbst (`ASSETS`, `NEXTJS_ENV`, …) liefert ohnehin schon `@opennextjs/cloudflare` über `getCloudflareContext()`.

### Static-Asset-Caching

[`public/_headers`](public/_headers) setzt für `/_next/static/*` ein `Cache-Control: public,max-age=31536000,immutable`, damit die gehashten Bundles von Cloudflare dauerhaft gecacht werden.

### Datenbank

Die Verbindung läuft über den **Neon-HTTP-Treiber** (`PrismaNeonHttp` in `src/lib/db.ts`). Das ist auf Workers nötig, weil dort keine langlebigen TCP-/WebSocket-Verbindungen bestehen dürfen. Ein anderer Postgres-Host (ohne Neon-HTTP-Endpoint) müsste stattdessen über **Hyperdrive** + `@prisma/adapter-pg` angebunden werden.

### POS-Ansagen (`public/pos-audio`)

Die MP3s liegen als Static Assets in `public/pos-audio`. Der Direktzugriff auf `/pos-audio/*` ist über `src/proxy.ts` gesperrt (`run_worker_first` in `wrangler.jsonc` stellt sicher, dass die Middleware dafür läuft). Ausgeliefert werden sie ausschließlich über die authentifizierte Route `/api/pos/audio/[key]`, die sie über die `ASSETS`-Binding liest. In der lokalen `next dev`-Umgebung ohne Wrangler greift ein Dateisystem-Fallback.

### Bekannte Einschränkungen

- **`src/proxy.ts` (Next-16-Middleware)** wird vom Adapter unterstützt, gilt aber noch als **experimentell** (`nodejs_compat` erforderlich). Der Build gibt dazu eine Warnung aus.
- Der lokale **Bon-Druckserver** (`printer/`) läuft weiterhin auf dem Tablet-Netzwerk und wird direkt vom Browser aufgerufen – davon ist das Worker-Deployment nicht betroffen. Wird das POS über HTTPS geladen, greift die Mixed-Content-Einschränkung (siehe unten).
- **Hexclave-Auth** ist nicht offiziell für Workers dokumentiert; die Architektur (Web-Crypto-JWTs, `Request`-basierter Token-Store, Cookie-Token-Store) sollte funktionieren, wurde aber nicht von Hexclave für Workers zertifiziert.

## Zahlungsfluss (RBank)

1. Server erstellt eine Zahlung via `createRbankPayment` (`src/lib/rbank.ts`).
2. Der Kunde wird auf den RBank-`paymentUrl` oder das eingebettete Checkout (`buildRbankEmbedCheckoutUrl`) geleitet.
3. Nach der Rückkehr verifiziert der Server die Zahlung mit `verifyRbankPayment` und markiert die Bestellung als `PAID` – die Einlösung (Gutschein-Link, Geschenkkarte, POS-Erfüllung) wird anschließend ausgelöst.

## Bon-Drucker (POS)

Nach einer bestätigten POS-Zahlung druckt das POS automatisch einen Bon an den
USB-Thermodrucker. Der eigentliche Druck läuft über den kleinen lokalen
Druckserver unter [`printer/`](printer/README.md):

```bash
cd printer
python3 server.py          # lauscht auf http://0.0.0.0:8787
```

Das **Tablet (Browser) ruft den Druckserver direkt** auf – die Adresse ist im
POS-Debug-Menü (10× auf das Logo tippen → „Bondrucker") einstellbar und lässt
sich dort per „Testbon drucken" prüfen. Standard ist `http://localhost:8787`;
läuft der Druckserver auf einem anderen Rechner, die lokale IP eintragen
(z. B. `http://192.168.1.50:8787`). Alternativ per `NEXT_PUBLIC_POS_PRINT_URL`.

> Hinweis: Wird das POS über **HTTPS** geladen, erlaubt der Browser direkte
> Aufrufe nur zu `http://localhost` – nicht zu einer LAN-IP (Mixed Content).
> Für eine LAN-IP das POS über HTTP laden (z. B. `http://192.168.1.50:3000`).

Der Bon enthält die **Bestellnummer groß oben**, Datum, Positionen, die
**Zusammenfassung** (Summe, ggf. Gutschein), die Zahlungsart und wird am Ende
automatisch abgeschnitten (Autocut). Für 58-mm-Papier ist die Breite auf 32
Zeichen voreingestellt; Umlaute werden standardmäßig nach ASCII übertragen
(ä→ae, ö→oe, ü→ue, ß→ss, €→EUR), damit sie auf jedem Drucker korrekt erscheinen.
Alle Optionen siehe [`printer/README.md`](printer/README.md).

### Bon-Designer (eigenständige HTML-Datei)

Zum Gestalten eigener Bons gibt es [`printer/bon-designer.html`](printer/bon-designer.html)
– eine **eigenständige** HTML-Datei (keine fyndo-Integration). Damit lassen sich
Bons aus Bausteinen zusammenbauen (Text, 2 Spalten, Trenner, **QR-Code**,
**Barcode**, Leerzeile, Schnitt), mit Live-Vorschau ansehen und über den
Druckserver ausdrucken. Vorlagen (Kassenbon, Bestellbon, Gutschein),
JSON-Export/-Import und automatisches Speichern im Browser sind enthalten.

Öffnen entweder direkt im Browser oder über den Druckserver:

```
http://localhost:8787/designer
```

Der Designer spricht den Druckserver direkt an (`/print/blocks` zum Drucken,
`/qr.png` für die QR-Vorschau). Der gedruckte QR-Code wird nativ per ESC/POS
erzeugt, der Barcode per `GS k` (CODE128).

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)
