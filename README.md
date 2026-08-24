# Fyndo

Fyndo ist ein smarter Online-Marktplatz, auf dem Händler Produkte verkaufen und Kundinnen eine zentrale Einkaufsseite für alles, was sie suchen, finden. Neben klassischen Produkten unterstützt Fyndo **Gutscheine**, **Geschenkkarten**, **Drittshop-Bestellungen** (Concierge) und ein integriertes **POS-System** (Kasse im Geschäft).

## Features

- **Marktplatz** – Übersicht aller aktiven Produkte inkl. Varianten, Preisen und Verkäufer-Profilseiten.
- **Checkout & Zahlung** – Vollständiger Kaufprozess mit Zahlung über **RBank** (gehosteter Redirect / eingebettetes Checkout) und Rabattlogik.
- **Gutscheine (Voucher)** – Produkte können als Gutscheine angelegt werden: feste Beträge oder Betragsränge (`min/max/step`), Rabatte als Festbetrag oder Prozent, Einlösung per Gutschein-Link.
- **Geschenkkarten (Gift Cards)** – Käufliche Fyndo-Gutscheine mit Betrag und persönlicher Nachricht; Status-Lebenszyklus `PENDING → ACTIVE → REDEEMED/EXPIRED`, einsetzbar als Zahlungsmittel im Checkout und POS.
- **Concierge / Drittshop-Bestellungen** – Bestellung eines beliebigen Produkts aus einem externen Shop per URL. Die App ruft die Shop-Metadaten (Name, Favicon, Host) ab und wickelt Anfrage → Angebot → Bestellung → Erfüllung ab.
- **POS-System** – Kassensystem pro Verkäufer: Kiosk-Modus, Bestellgruppen, Nummern-Karten, Lock-Screen, Containers & Toppings, Varianten, Audio-Ansagen (Speech), Zahlungsarten (RBank, QR/Tippie, Terminal, Bar, Gutschein).
- **POS-Bestellübersicht (Board)** – McDonald's-ähnlicher Vollbild-Bildschirm unter `/pos/[vendor]/board`: links „In Bearbeitung“, rechts „Zur Abholung bereit“. Es werden nur **bezahlte** Bestellungen angezeigt (unbezahlte werden ausgeblendet), dargestellt als große **Bestellnummern** ohne Artikel-Details. Neue Bestellungen ploppen groß auf und wandern klein in die linke Spalte; beim Wechsel auf „Ausgeführt“ kommt erneut ein großes Pop-up („Zur Abholung bereit“), die Nummer fliegt nach rechts und verschwindet nach **10 Minuten** (Countdown + Fortschrittsbalken) automatisch. Öffnen lässt sich das Board über den Button „Bestellübersicht“ im POS-Admin-Bereich.
- **Admin-Bereich** – Verwaltung von Verkäufern, Produkten, Concierge-Bestellungen, Auszahlungsanträgen und Einstellungen.
- **Benachrichtigungen** – Push-Benachrichtigungen über **ntfy.sh** bei bezahlten Bestellungen, Drittshop-Anfragen und POS-Zahlungen.
- **Demo-Modus** – Vorschau der App unter `/demos` mit Beispieldaten und ohne echtes Checkout: Fyndo-Marktplatz (inkl. Admin), Fyndo-POS und die **Bestellübersicht** unter `/demos/pos-board` (Live-Simulation mit verkürzter Abholzeit, damit der komplette Zyklus sofort sichtbar ist). Bestellungen, die im POS-Kiosk-Demo aufgegeben werden, erscheinen automatisch auf dem Demo-Board (am besten in zwei Tabs nebeneinander öffnen). Ein Umschalter ganz oben wechselt zwischen den Bereichen; die Seiten sind nur anschaubar, alle Aktionen sind deaktiviert.

## Tech-Stack

- **Next.js 16** (App Router, Server Components) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + PostCSS
- **Prisma 7** mit **Neon** (PostgreSQL, serverless)
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

## Skripte

| Befehl | Beschreibung |
| --- | --- |
| `pnpm dev` | Next.js-Entwicklungsserver |
| `pnpm build` | Produktions-Build |
| `pnpm start` | Produktionsserver starten |
| `pnpm postinstall` | Wird automatisch ausgeführt; generiert den Prisma-Client |

## Projektstruktur

```
prisma/                     Prisma-Schema und Migrationen
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
src/generated/prisma/        Generierter Prisma-Client
src/hexclave/                Hexclave-Server-App-Setup
src/lib/                     Business-Logik (auth, checkout, env, gift-card, ntfy,
                             pos, rbank, shop, third-party-order, vendor, ...)
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

Der Prisma-Client wird nach `src/generated/prisma` generiert und wird durch `postinstall` bei jedem `install` aktualisiert.

## Zahlungsfluss (RBank)

1. Server erstellt eine Zahlung via `createRbankPayment` (`src/lib/rbank.ts`).
2. Der Kunde wird auf den RBank-`paymentUrl` oder das eingebettete Checkout (`buildRbankEmbedCheckoutUrl`) geleitet.
3. Nach der Rückkehr verifiziert der Server die Zahlung mit `verifyRbankPayment` und markiert die Bestellung als `PAID` – die Einlösung (Gutschein-Link, Geschenkkarte, POS-Erfüllung) wird anschließend ausgelöst.

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)
