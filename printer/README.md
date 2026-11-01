# Fyndo Bon-Druckserver

Kleiner HTTP-Server, der Kassenbons für den **fyndo POS** an den USB-Bondrucker
schickt. Er rendert ESC/POS-Bytes (inkl. **Autocut**) und übergibt sie roh an
CUPS oder direkt an ein USB-Gerät.

```
fyndo POS (Tablet/Browser)
        │  POST /api/pos/print  (oder direkt /print)
        ▼
Druckserver  ──lp -o raw──►  CUPS-Queue "Bondrucker"  ──►  🧾
```

## Starten

```bash
cd printer
./start.sh
```

`start.sh` erzeugt beim ersten Mal ein Token in `.print-token` (gitignored) und
startet den Server damit. Das Token wird automatisch von `server.py` gelesen –
es ist **keine** Umgebungsvariable nötig. Ausgegeben werden die fertigen URLs:

```
POS-URL:   https://<tunnel-host>/<token>
Im WLAN:   http://192.168.x.x:8787/<token>
```

Läuft der Cloudflare-Tunnel als Dienst (LaunchDaemon), muss nur `start.sh`
laufen; die öffentliche URL steht in `.print-host`.

Standardmäßig lauscht der Server auf `0.0.0.0:8787` und druckt über die
CUPS-Queue **Bondrucker**.

> Auf macOS hängt der Drucker meist als serielles Gerät (`/dev/cu.*`), siehe
> [macOS: Drucker per USB oder Bluetooth verbinden](#macos-drucker-per-usb-oder-bluetooth-verbinden):
> `PRINTER_MODE=device PRINTER_DEVICE=auto ./start.sh`

Schnelltest (Token als erstes Pfadsegment):

```bash
TOKEN=$(cat .print-token)
curl -X POST "http://localhost:8787/$TOKEN/test"
curl "http://localhost:8787/$TOKEN/health"
```

## Endpunkte

| Methode | Pfad            | Beschreibung                                        |
| ------- | --------------- | --------------------------------------------------- |
| `GET`   | `/health`       | Status / Konfiguration                               |
| `GET`   | `/devices`      | Serielle Drucker-Geräte finden (`/dev/cu.*`, `/dev/ttyUSB*`) |
| `GET`   | `/cert`         | Zertifikat für iPhone/iPad herunterladen (`HTTPS=1`) |
| `GET`   | `/printers`     | CUPS-Drucker auflisten                               |
| `GET`   | `/qr.png`       | QR-Code als PNG-Vorschau (`?data=…&size=4`, via `qrencode`) |
| `GET`   | `/designer`     | Eigenständiger **Bon-Designer** (HTML)               |
| `POST`  | `/print`        | Strukturierter Bon (JSON, siehe unten)               |
| `POST`  | `/print/blocks` | Freie Design-Blöcke (Bon-Designer, siehe unten)      |
| `POST`  | `/print/text`   | `{ "text": "Zeile1\nZeile2" }`                       |
| `POST`  | `/print/raw`    | `{ "base64": "..." }` rohe ESC/POS-Bytes             |
| `POST`  | `/test`         | Testbon drucken                                      |

### Beispiel `/print`

```bash
curl -X POST http://localhost:8787/print \
  -H 'Content-Type: application/json' \
  -d '{
    "vendorName": "Sweet Cream",
    "orderNumber": 42,
    "date": "2026-10-13T20:31:00Z",
    "items": [
      { "qty": 2, "name": "Vanille Becher", "amountCents": 400 },
      { "qty": 1, "name": "Schoko Kugel", "amountCents": 250 }
    ],
    "totalCents": 650,
    "paymentMethod": "CASH",
    "footer": "Vielen Dank!"
  }'
```

Der Bon enthält oben die **Bestellnummer** groß, darunter Datum, Positionen,
**Zusammenfassung** (Summe, ggf. Gutschein), Zahlungsart und am Ende den
**Autocut**.

## Bon-Designer (eigenständige HTML-Datei)

`bon-designer.html` ist ein **eigenständiges** Werkzeug (keine fyndo-Integration),
mit dem man Bons visuell zusammenbaut und druckt:

- Bausteine: Text (Ausrichtung, Größe, fett, unterstrichen), 2 Spalten,
  Trennlinie, **QR-Code**, **Barcode (CODE128)**, Leerzeile, Schnitt, Rohtext
- **Unicode/CJK**: mit Zeichensatz `Auto` werden Umlaute nativ und Chinesisch
  (und andere Schriftsysteme) als Bitmap gedruckt (siehe Abschnitt
  „Chinesisch / andere Schriftsysteme")
- Undo/Redo, Drag-&-Drop-Sortierung, einklappbare Bausteine, sticky Vorschau
- Live-Vorschau im 58-mm-/80-mm-Layout (markiert zu lange Zeilen)
- Vorlagen: Kassenbon, Bestellbon, Gutschein
- Export/Import als JSON, automatisches Speichern im Browser (localStorage)
- Druck über den Druckserver oder Browser-Druck (58 mm)

Öffnen: Datei direkt im Browser **oder** bequem über den Server:

```
http://localhost:8787/designer
```

Der Designer spricht den Druckserver direkt an (`/print/blocks` für den Druck,
`/qr.png` für die QR-Vorschau). Der gedruckte QR-Code wird **nativ** per
ESC/POS (`GS ( k`, Modell 2) erzeugt, der Barcode per `GS k` (CODE128).

> Hinweis: Die QR-Vorschau im Designer nutzt das Systemwerkzeug `qrencode`
> (meist vorinstalliert). Fehlt es, zeigt die Vorschau einen Platzhalter –
> gedruckt wird der QR trotzdem korrekt.

### Beispiel `/print/blocks`

```bash
curl -X POST http://localhost:8787/print/blocks \
  -H 'Content-Type: application/json' \
  -d '{
    "width": 32,
    "charset": "ascii",
    "copies": 1,
    "blocks": [
      { "type": "text", "text": "Sweet Cream", "align": "center", "size": "double", "bold": true },
      { "type": "hr", "char": "=" },
      { "type": "cols", "left": "SUMME:", "right": "7,50 €" },
      { "type": "qr", "data": "https://fyndo.sdtoll.de/receipt/1042", "size": 6, "ec": "M" },
      { "type": "barcode", "data": "1042", "height": 60 },
      { "type": "feed", "lines": 2 },
      { "type": "cut" }
    ]
  }'
```

| Blocktyp  | Felder                                                              |
| --------- | ------------------------------------------------------------------- |
| `text`    | `text`, `align` (left/center/right), `size` (normal/tall/wide/double), `bold`, `underline` |
| `cols`    | `left`, `right`                                                      |
| `hr`      | `char`                                                               |
| `qr`      | `data`, `size` (Modul 1–16), `ec` (L/M/Q/H), `align`                 |
| `barcode` | `data` (CODE128), `height`, `width` (2–6), `hri` (0–3), `align`      |
| `feed`    | `lines`                                                              |
| `cut`     | –                                                                    |
| `raw`     | `text`                                                               |

Die Felder `width`, `charset` und `copies` können pro Anfrage mitgegeben werden
und überschreiben die Server-Standardwerte.

## Konfiguration (Umgebungsvariablen)

| Variable         | Standard        | Beschreibung                                              |
| ---------------- | --------------- | --------------------------------------------------------- |
| `PORT`           | `8787`          | HTTP-Port                                                 |
| `HOST`           | `0.0.0.0`       | Bind-Adresse                                              |
| `HTTPS`          | aus             | `1` = TLS aktivieren (nötig für POS über `https://`)      |
| `SSL_CERT`       | auto            | Zertifikat (PEM); sonst selbstsigniert in `printer/certs/` |
| `SSL_KEY`        | auto            | Privater Schlüssel zum Zertifikat                         |
| `PRINTER_TOKEN`  | leer            | Optionales Token; erlaubt als `X-Print-Token`-Header, `?token=` **oder** erstes Pfadsegment (`/<token>/print`) |
| `PRINTER_NAME`   | `Bondrucker`    | CUPS-Queue-Name                                           |
| `PRINTER_MODE`   | `cups`          | `cups` (lp -o raw) oder `device` (direkt schreiben)       |
| `PRINTER_DEVICE` | `/dev/usb/lp0`  | Nur bei `PRINTER_MODE=device`; `auto` erkennt USB/Bluetooth automatisch |
| `PRINTER_BAUD`   | `9600`          | Baudrate für serielle Geräte (`/dev/cu.*`, `/dev/ttyUSB*`) |
| `PRINTER_FLOW`   | `none`          | Flusskontrolle: `none`, `rtscts` oder `xonxoff`           |
| `PRINTER_WIDTH`  | `32`            | Zeichen pro Zeile (58 mm = 32, 80 mm = 48)                |
| `CHARSET`        | `ascii`         | `ascii`, `cp437`, `cp858`, `auto` (CJK als Bitmap) oder `image` (immer Bitmap) |
| `CUT_MODE`       | `partial`       | `partial` (GS V B 0), `full` (GS V 0) oder `none`         |
| `FEED_LINES`     | `4`             | Vorschub vor dem Schnitt                                  |
| `DOTS_PER_CHAR`  | `12`            | Punktbreite einer Zeichenzelle beim Rasterdruck (203 dpi) |
| `RASTER_FONT_PX` | `2*DOTS_PER_CHAR` | Schriftgröße in px für den Rasterdruck                  |
| `CJK_FONT`       | auto            | Pfad zu einem CJK-TTF/TTC (sonst automatische Suche)      |

### Zeichensatz / Umlaute

Viele günstige 58-mm-Drucker nutzen intern **GBK** und ignorieren die
ESC/POS-Codepage-Umschaltung – dann erscheinen Umlaute als chinesische Zeichen.
Deshalb ist der Standard `CHARSET=ascii`: Umlaute werden sauber übertragen
(ä→ae, ö→oe, ü→ue, ß→ss, €→EUR) und funktionieren auf **jedem** Drucker.

Unterstützt der Drucker eine Latin-Codepage, echte Umlaute versuchen mit:

```bash
CHARSET=cp437 python3 server.py   # ESC t 0
CHARSET=cp858 python3 server.py   # ESC t 19 (inkl. €)
```

### Chinesisch / andere Schriftsysteme (`charset: auto`)

Die eingebauten Druckerschriften sind reine 1-Byte-Zeichensätze und kennen
**keine** chinesischen (oder kyrillischen, japanischen …) Glyphen – ohne
Rasterdruck landen dort nur `?`. Mit `charset: "auto"` rendert der Server
solche Zeilen als **Bitmap** und schickt sie per ESC/POS-Rasterbefehl
(`GS v 0`) an den Drucker:

- lateinische Zeilen (inkl. Umlauten, `€`) bleiben schnell & gestochen scharf
  im eingebauten Druckerfont (Codepage 858),
- alles, was die Codepage nicht kann (z. B. 中文), wird als Bild gedruckt.

Voraussetzung: **Pillow** und ein CJK-Font sind installiert (auf diesem System
`python3-pil` + `fonts-wqy-zenhei`/`fonts-noto-cjk`). Beides wird automatisch
gefunden; `GET /health` meldet `"cjk": true`. `charset: "image"` erzwingt für
**jede** Zeile den Bitmap-Weg.

Lange Zeilen werden beim Rasterdruck **automatisch auf die Papierbreite
umgebrochen** (Bitmaps brechen – anders als der eingebaute Druckerfont – nicht
selbst um). Gerendert wird mit dem **BASIC-Layout** von Pillow (ohne Raqm),
dadurch gibt es bei sehr viel Text keinen `raqm_layout() failed.`-Fehler.
Schlägt das Rendern einer Zeile wider Erwarten fehl, fällt der Server automatisch
auf nativen Text zurück, statt die ganze Anfrage abzubrechen.

```bash
# Test: chinesischer Bon (siehe auch den Bon-Designer)
curl -s -X POST http://localhost:8787/print/blocks -H 'Content-Type: application/json' -d '{
  "charset":"auto","width":32,
  "blocks":[{"type":"text","text":"你好，世界","align":"center","size":"double","bold":true},
            {"type":"cols","left":"珍珠奶茶","right":"5,90 €"}]}'
```

### macOS: Drucker per USB oder Bluetooth verbinden

Auf macOS taucht ein Thermodrucker meist als **serielles Gerät** auf:

```bash
ls /dev/cu.*                 # z. B. /dev/cu.usbmodem11101 (USB), /dev/cu.Printer001 (Bluetooth)
python3 server.py            # in einem anderen Terminal: GET /devices listet die Kandidaten
```

Der Server wählt mit `PRINTER_DEVICE=auto` automatisch das erste passende Gerät
(USB vor Bluetooth):

```bash
PRINTER_MODE=device PRINTER_DEVICE=auto python3 server.py
```

Oder fest verdrahtet – der Name hinter `cu.` ist der Geräte-/Bluetooth-Name:

```bash
# USB
PRINTER_MODE=device PRINTER_DEVICE=/dev/cu.usbmodem11101 python3 server.py
# Bluetooth (SPP)
PRINTER_MODE=device PRINTER_DEVICE=/dev/cu.Printer001 PRINTER_BAUD=9600 python3 server.py
```

Danach testen:

```bash
curl -X POST http://localhost:8787/test
curl http://localhost:8787/devices
```

Serielle Ports werden automatisch auf **8N1 / raw** gestellt. Kommt bei
Bluetooth nichts an, andere Baudrate probieren (`PRINTER_BAUD=115200`) oder
`PRINTER_FLOW=rtscts`. Alternativ lässt sich der Drucker als CUPS-Queue
einrichten; `-o raw` beim Drucken umgeht dann jeden Filter:

```bash
lpinfo -v                                    # usb://Printer/... anzeigen
# macOS erlaubt keine reinen Raw-Queues mehr -> generisches PPD verwenden:
lpadmin -p Bondrucker -E -v 'usb://Printer/USB%20Printer%20P?serial=565357953100' \
        -m drv:///sample.drv/generic.ppd
```

### Cloudflare Tunnel + Token (empfohlen für iPhone/iPad)

Statt lokalem Zertifikat kann `cloudflared` den Druckserver mit gültigem HTTPS
veröffentlichen. Der Server bleibt auf HTTP – TLS macht Cloudflare:

```bash
brew install cloudflared
cloudflared tunnel login                       # einmalig, Zone auswählen
cloudflared tunnel create fyndo-print
cloudflared tunnel route dns fyndo-print print.sdtoll.de
TUNNEL_NAME=fyndo-print ./start-tunnel.sh
```

`start-tunnel.sh` erzeugt beim ersten Start ein Token in `.print-token` (nicht
im Git) und startet Server + Tunnel. Das Token wird als **erstes Pfadsegment**
akzeptiert, damit das POS nur eine Basis-URL braucht:

```
POS-Druckserver:  https://print.sdtoll.de/<TOKEN>
Health-Check:     https://print.sdtoll.de/<TOKEN>/health
```

Im POS-Debug-Menü genau diese URL eintragen (ohne `/health`). Aufrufe ohne
Token antworten mit `401`.

Ohne eigene Domain geht auch ein Quick Tunnel (URL ändert sich bei jedem Start):

```bash
./start-tunnel.sh          # gibt https://<random>.trycloudflare.com/<TOKEN> aus
```

> Cloudflare **Access** ist für den POS-Aufruf ungeeignet: der `OPTIONS`-
> Preflight bekommt von Access ein 403, und `fetch` sendet keine
> `CF_Authorization`-Cookies. Das Token übernimmt hier die Absicherung.
> Access lässt sich höchstens zusätzlich auf `/designer` legen.

### Druck vom iPhone/iPad (Fyndo POS) – „Load failed"

Das POS läuft normalerweise über **HTTPS** (z. B. `https://fyndo.sdtoll.de`).
Safari blockiert dann `fetch()`-Aufrufe an `http://192.168.x.x:8787` als
**Mixed Content**. Genau deshalb funktioniert die Adresse in einem **neuen Tab**
(normale Navigation ist erlaubt), im POS erscheint aber
„Nicht erreichbar: Load failed".

Lösung: den Druckserver über HTTPS starten:

```bash
HTTPS=1 python3 server.py
```

Beim ersten Start entsteht eine kleine CA (`printer/certs/ca.crt`, 10 Jahre) und
ein Server-Zertifikat (`server.crt`, 397 Tage, wird automatisch erneuert, wenn
es abläuft oder sich die IP ändert). Grund für die kurze Laufzeit: **iOS/macOS
akzeptieren TLS-Server-Zertifikate nur mit maximal 825 Tagen Laufzeit** – ein
10-Jahres-Zertifikat wird trotz Trust-Einstellung verworfen (`Load failed`).

Auf dem iPhone/iPad einmalig die **CA** vertrauen:

1. `https://<IP-des-Macs>:8787/cert` in Safari öffnen (Zertifikatswarnung bestätigen)
2. Profil herunterladen → **Einstellungen → Allgemein → VPN & Device Management** → installieren
3. **Einstellungen → Allgemein → Info → Zertifikatsvertrauen** → „fyndo-print CA" aktivieren

> Falls vorher schon ein altes selbstsigniertes Zertifikat installiert wurde:
> dieses Profil entfernen und das neue CA-Profil installieren. Die CA bleibt
> 10 Jahre gültig, spätere Server-Zertifikate brauchen keine neue Installation.

**Wenn weiterhin „Load failed" kommt:**

1. In Safari `https://<IP>:8787/health` öffnen – erscheint noch eine
   Zertifikatswarnung, ist das Vertrauen nicht aktiv (Schritt 3 oben).
2. Im POS-Debug-Menü muss die Adresse mit **`https://`** beginnen.
3. IP geändert? Der Server erneuert das Server-Zertifikat beim nächsten Start
   automatisch (SAN wird verglichen), die CA bleibt gleich.
4. Exakte Fehlermeldung: iPhone per Kabel verbinden → Safari am Mac →
   **Entwickler → iPhone → Seite** → Konsole. Dort steht z. B.
   „TLS-Fehler" (Zertifikat) oder „Mixed Content" (noch `http://` eingetragen).

Danach im POS-Debug-Menü `https://<IP-des-Macs>:8787` eintragen (z. B.
`https://192.168.188.186:8787`). Der Bon-Designer übernimmt die Adresse
automatisch, wenn er über den Server geöffnet wird.

Eigenes (z. B. Let's-Encrypt-)Zertifikat:

```bash
HTTPS=1 SSL_CERT=/pfad/fullchain.pem SSL_KEY=/pfad/privkey.pem python3 server.py
```

> Ohne Zertifikatsinstallation auf dem Gerät: siehe
> [Cloudflare Tunnel + Token](#cloudflare-tunnel--token-empfohlen-für-iphoneipad).

### Direkt am USB-Gerät drucken (ohne CUPS)

```bash
PRINTER_MODE=device PRINTER_DEVICE=/dev/usb/lp0 python3 server.py
```

> Hinweis: Zugriff auf `/dev/usb/lp0` erfordert meist Mitgliedschaft in der
> Gruppe `lp` (`sudo usermod -aG lp $USER`, danach neu anmelden).

## Automatisch starten (systemd, als Benutzerdienst)

```bash
mkdir -p ~/.config/systemd/user
cp printer/fyndo-print.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now fyndo-print.service
systemctl --user status fyndo-print.service
```

> Ggf. `WorkingDirectory` und `ExecStart` (Python-Pfad) in der Service-Datei
> anpassen. Damit der Dienst nach dem Abmelden weiterläuft:
> `sudo loginctl enable-linger $USER`

## Ohne Server drucken (nur Shell)

`print-bon.sh` zeigt den minimalen Weg mit rohen ESC/POS-Bytes:

```bash
./print-bon.sh "Was ist ein Baum? Ein Baum ist eine Pflanze."
```

## Drucker prüfen

```bash
lpstat -p -d            # Status + Standarddrucker
lpstat -v Bondrucker    # Geräte-URI der Queue
```
