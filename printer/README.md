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
python3 server.py
```

Standardmäßig lauscht der Server auf `0.0.0.0:8787` und druckt über die
CUPS-Queue **Bondrucker**.

Schnelltest:

```bash
curl -X POST http://localhost:8787/test
curl http://localhost:8787/health
```

## Endpunkte

| Methode | Pfad            | Beschreibung                                        |
| ------- | --------------- | --------------------------------------------------- |
| `GET`   | `/health`       | Status / Konfiguration                               |
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
- Live-Vorschau im 58-mm-/80-mm-Layout
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
| `PRINTER_NAME`   | `Bondrucker`    | CUPS-Queue-Name                                           |
| `PRINTER_MODE`   | `cups`          | `cups` (lp -o raw) oder `device` (direkt schreiben)       |
| `PRINTER_DEVICE` | `/dev/usb/lp0`  | Nur bei `PRINTER_MODE=device`                             |
| `PRINTER_WIDTH`  | `32`            | Zeichen pro Zeile (58 mm = 32, 80 mm = 48)                |
| `CHARSET`        | `ascii`         | `ascii` (Umlaute transliterieren), `cp437` oder `cp858`   |
| `CUT_MODE`       | `partial`       | `partial` (GS V B 0), `full` (GS V 0) oder `none`         |
| `FEED_LINES`     | `4`             | Vorschub vor dem Schnitt                                  |

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
