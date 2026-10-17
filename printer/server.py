#!/usr/bin/env python3
"""
Fyndo Bon-Druckserver
=====================

Kleiner, dependency-freier HTTP-Server, der Kassenbons für den fyndo POS als
rohe ESC/POS-Bytes an einen Thermodrucker schickt.

Der Drucker wird standardmäßig über die CUPS-Queue "Bondrucker" angesprochen
(``lp -d Bondrucker -o raw``). Alternativ kann direkt auf ein USB-Gerät
geschrieben werden (z. B. ``/dev/usb/lp0``).

Endpunkte
---------
  GET  /health        Status / Konfiguration
  GET  /printers      CUPS-Drucker auflisten
  GET  /qr.png        QR-Code als PNG-Vorschau (via qrencode)
  POST /print         strukturierter Bon (JSON)
  POST /print/blocks  freie Design-Blöcke (für den Bon-Designer)
  POST /print/text    {"text": "Zeile1\\nZeile2"}
  POST /print/raw     {"base64": "..."} rohe ESC/POS-Bytes
  POST /test          Testbon drucken

Start
-----
  python3 server.py
  PRINTER_WIDTH=32 CHARSET=ascii python3 server.py

Siehe README.md für alle Optionen.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

PORT = int(os.environ.get("PORT", "8787"))
HOST = os.environ.get("HOST", "0.0.0.0")
PRINTER_NAME = os.environ.get("PRINTER_NAME", "Bondrucker")
PRINTER_MODE = os.environ.get("PRINTER_MODE", "cups").lower()  # cups | device
PRINTER_DEVICE = os.environ.get("PRINTER_DEVICE", "/dev/usb/lp0")
LP_BIN = os.environ.get("LP_BIN", "lp")
LPSTAT_BIN = os.environ.get("LPSTAT_BIN", "lpstat")
QRENCODE_BIN = os.environ.get("QRENCODE_BIN", "qrencode")

# Papierbreite in Zeichen (Font A): 58 mm ≈ 32, 80 mm ≈ 48.
WIDTH = int(os.environ.get("PRINTER_WIDTH", "32"))

# Zeichensatz (kann pro Anfrage über das Feld "charset" überschrieben werden):
#   ascii  – Umlaute werden transliteriert (ä→ae, ö→oe, ü→ue, ß→ss, €→EUR).
#            Funktioniert auf JEDEM Drucker, auch wenn dieser intern GBK nutzt.
#   cp437  – echte Umlaute über Codepage 437 (ESC t 0), falls unterstützt.
#   cp858  – echte Umlaute über Codepage 858 (ESC t 19), inkl. €.
CHARSET = os.environ.get("CHARSET", "ascii").lower()

CUT_MODE = os.environ.get("CUT_MODE", "partial").lower()  # partial | full | none
FEED_LINES = int(os.environ.get("FEED_LINES", "4"))
MAX_BODY_BYTES = 1024 * 1024  # 1 MB

# ---------------------------------------------------------------------------
# ESC/POS
# ---------------------------------------------------------------------------

ESC = 0x1B
GS = 0x1D
LF = 0x0A

# Bytes für echte Umlaute (CP437 und CP858 teilen sich diese Werte).
LATIN_MAP = {
    "€": 0xD5,
    "Ä": 0x8E,
    "Ö": 0x99,
    "Ü": 0x9A,
    "ä": 0x84,
    "ö": 0x94,
    "ü": 0x81,
    "ß": 0xE1,
    "°": 0xF8,
    "²": 0xFD,
    "³": 0xFC,
    "µ": 0xE6,
    "·": 0xFA,
    "á": 0xA0,
    "à": 0x85,
    "â": 0x83,
    "å": 0x86,
    "ç": 0x87,
    "é": 0x82,
    "è": 0x8A,
    "ê": 0x88,
    "ë": 0x89,
    "í": 0xA1,
    "î": 0x8C,
    "ï": 0x8B,
    "ñ": 0xA4,
    "ó": 0xA2,
    "ô": 0x93,
    "ú": 0xA3,
    "û": 0x96,
    "ù": 0x97,
    "¡": 0xAD,
    "¿": 0xA8,
    "£": 0x9C,
    "¢": 0xBD,
    "©": 0xB8,
    "®": 0xA9,
    "±": 0xF1,
    "÷": 0xF6,
    "§": 0x15,
}

# Transliteration nach reinem ASCII (immer korrekt darstellbar).
ASCII_MAP = {
    "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss",
    "€": "EUR",
    "á": "a", "à": "a", "â": "a", "å": "a", "ã": "a", "æ": "ae",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "ô": "o", "õ": "o", "ø": "o",
    "ú": "u", "ù": "u", "û": "u",
    "ç": "c", "ñ": "n", "ý": "y",
    "°": " ", "²": "2", "³": "3", "µ": "u", "·": "*",
    "£": "GBP", "¢": "c", "©": "(c)", "®": "(R)", "§": "Par.", "±": "+/-",
}

CHARSET_CODEPAGE = {"cp437": 0, "cp858": 19}
VALID_CHARSETS = ("ascii", "cp437", "cp858")

_TYPO = {
    "\u00a0": " ",  # NBSP
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
    "\u2015": "-",
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2026": "...",
    "\u2022": "*",
    "\t": "    ",
}


def normalize(text: str) -> str:
    """Typografische Sonderzeichen auf ASCII normalisieren."""
    return "".join(_TYPO.get(ch, ch) for ch in str(text))


def transliterate(text: str) -> str:
    """Nicht-ASCII nach ASCII übertragen (ä→ae …)."""
    out = []
    for ch in text:
        code = ord(ch)
        if code < 0x80:
            out.append(ch)
        elif ch in ASCII_MAP:
            out.append(ASCII_MAP[ch])
        else:
            out.append("?")
    return "".join(out)


def disp(text, charset: str | None = None) -> str:
    """Text für die Ausgabe vorbereiten (Länge = spätere Zeichenbreite)."""
    cs = (charset or CHARSET).lower()
    s = normalize(text)
    if cs == "ascii":
        s = transliterate(s)
    return s


def encode(text: str) -> bytes:
    """String in Drucker-Bytes wandeln (1 Byte pro Zeichen)."""
    out = bytearray()
    for ch in text:
        code = ord(ch)
        if code < 0x80:
            out.append(code)
        else:
            out.append(LATIN_MAP.get(ch, 0x3F))
    return bytes(out)


class EscPos:
    """Minimaler ESC/POS-Builder."""

    def __init__(self, width: int = WIDTH, charset: str | None = None):
        self.width = width
        self.charset = (charset or CHARSET).lower()
        self.parts: list[bytes] = []

    def raw(self, *parts) -> "EscPos":
        for p in parts:
            if isinstance(p, (bytes, bytearray)):
                self.parts.append(bytes(p))
            elif isinstance(p, int):
                self.parts.append(bytes([p]))
            elif isinstance(p, (list, tuple)):
                self.parts.append(bytes(p))
            else:
                self.parts.append(encode(disp(str(p), self.charset)))
        return self

    def init(self) -> "EscPos":
        return self.raw([ESC, 0x40])

    def codepage(self) -> "EscPos":
        if self.charset in CHARSET_CODEPAGE:
            return self.raw([ESC, 0x74, CHARSET_CODEPAGE[self.charset]])
        return self

    def align(self, a: str) -> "EscPos":
        n = 1 if a == "center" else 2 if a == "right" else 0
        return self.raw([ESC, 0x61, n])

    def bold(self, on: bool) -> "EscPos":
        return self.raw([ESC, 0x45, 1 if on else 0])

    def size(self, n: int) -> "EscPos":
        """0 normal, 0x10 doppelte Höhe, 0x01 doppelte Breite, 0x11 doppelt."""
        return self.raw([GS, 0x21, n])

    def text(self, s) -> "EscPos":
        return self.raw(encode(disp(s, self.charset)))

    def line(self, s="") -> "EscPos":
        if s == "":
            return self.raw([LF])
        return self.raw(encode(disp(s, self.charset))).raw([LF])

    def feed(self, n: int = FEED_LINES) -> "EscPos":
        return self.raw([ESC, 0x64, max(0, min(255, n))])

    def cut(self) -> "EscPos":
        if CUT_MODE == "none":
            return self
        if CUT_MODE == "full":
            return self.raw([GS, 0x56, 0x00])
        # Teil-Schnitt mit Vorschub – GS V B 0 (wie im Shell-Beispiel).
        return self.raw([GS, 0x56, 0x42, 0x00])

    def hr(self, ch: str = "-") -> "EscPos":
        return self.line(ch * self.width)

    def cols(self, left, right) -> "EscPos":
        """Zwei Spalten: links, rechts rechtsbündig, ggf. links abschneiden."""
        r = disp(right, self.charset)
        max_left = max(0, self.width - len(r) - 1)
        l = disp(left, self.charset)
        if len(l) > max_left:
            l = l[:max_left]
        pad = max(1, self.width - len(l) - len(r))
        return self.line(l + " " * pad + r)

    def build(self) -> bytes:
        return b"".join(self.parts)


# ---------------------------------------------------------------------------
# Bon-Rendering
# ---------------------------------------------------------------------------

def _pick_charset(payload: dict) -> str:
    cs = str(payload.get("charset") or "").lower()
    return cs if cs in VALID_CHARSETS else CHARSET


def format_euro(cents) -> str:
    try:
        value = int(round(float(cents or 0)))
    except (TypeError, ValueError):
        value = 0
    sign = "-" if value < 0 else ""
    value = abs(value)
    euros, rest = divmod(value, 100)
    return f"{sign}{euros:,}".replace(",", ".") + f",{rest:02d} €"


def format_datetime(value=None) -> str:
    if value:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now()
    else:
        dt = datetime.now()
    return dt.strftime("%d.%m.%Y %H:%M")


def payment_label(method) -> str:
    m = str(method or "").upper()
    return {
        "CASH": "Bar",
        "BAR": "Bar",
        "RBANK": "RBank",
        "TIPPIE": "PayPal / Apple Pay",
        "TERMINAL": "Kartenterminal",
        "GUTSCHEIN": "Fyndo-Gutschein",
        "CARD": "Karte",
    }.get(m, str(method) if method else "")


def render_receipt(payload: dict | None = None) -> bytes:
    """Erzeugt die rohen ESC/POS-Bytes für einen Bon.

    payload:
      vendorName, orderNumber, date, items[{qty,name,amountCents,unitCents}],
      subtotalCents, totalCents, giftCardCents, paymentMethod, header, footer,
      note, width, charset, copies
    """
    payload = payload or {}
    width = int(payload.get("width") or WIDTH) or WIDTH
    cs = _pick_charset(payload)
    p = EscPos(width, cs)

    def D(t) -> str:
        return disp(t, cs)

    items = payload.get("items") if isinstance(payload.get("items"), list) else []
    total_cents = int(
        payload.get("totalCents")
        if payload.get("totalCents") is not None
        else sum(int(i.get("amountCents") or 0) for i in items)
    )
    gift_cents = int(payload.get("giftCardCents") or 0)
    subtotal_cents = int(
        payload.get("subtotalCents")
        if payload.get("subtotalCents") is not None
        else total_cents + gift_cents
    )

    p.init().codepage().align("center")

    # Kopf
    vendor = D(payload.get("vendorName") or "fyndo")
    p.bold(True)
    if len(vendor) <= width // 2:
        p.size(0x11).line(vendor).size(0x00)
    else:
        p.size(0x10).line(vendor).size(0x00)
    p.bold(False)
    if payload.get("header"):
        p.line(D(payload["header"]))
    p.line()

    # Bestellnummer groß und weit oben
    if payload.get("orderNumber") is not None:
        num = f"#{payload['orderNumber']}"
        p.bold(True)
        if len(num) <= width // 2:
            p.size(0x11).line(num).size(0x00)
        else:
            p.size(0x10).line(num).size(0x00)
        p.bold(False)
        p.line("BESTELLUNG")

    p.align("left")
    p.hr("=")
    p.cols("Datum:", format_datetime(payload.get("date")))
    if payload.get("vendorName"):
        p.cols("Filiale:", D(payload["vendorName"])[: max(1, width - 9)])
    p.hr("-")

    # Positionen
    if not items:
        p.line("(keine Positionen)")
    else:
        for item in items:
            qty = int(item.get("qty") or 1)
            if item.get("amountCents") is not None:
                amount = int(item.get("amountCents") or 0)
            else:
                amount = int(item.get("unitCents") or 0) * qty
            prefix = f"{qty}x " if qty > 1 else ""
            name = D(prefix + str(item.get("name") or item.get("title") or "Artikel"))
            price = D(format_euro(amount))
            max_left = max(8, width - len(price) - 1)
            chunks = []
            rest = name
            while len(rest) > max_left:
                chunks.append(rest[:max_left])
                rest = rest[max_left:]
            chunks.append(rest)
            for i, chunk in enumerate(chunks):
                if i == len(chunks) - 1:
                    p.cols(chunk, price)
                else:
                    p.line(chunk)

    p.hr("-")

    # Zusammenfassung
    if gift_cents > 0:
        p.cols("Zwischensumme:", format_euro(subtotal_cents))
        p.cols("Gutschein:", f"-{format_euro(gift_cents)}")
    p.bold(True).cols("SUMME:", format_euro(total_cents)).bold(False)

    pay = payment_label(payload.get("paymentMethod"))
    if pay:
        p.cols("Zahlung:", pay)

    if payload.get("note"):
        p.hr("-")
        p.text("Hinweis: ").line(D(payload["note"]))

    # Fuß
    p.align("center")
    p.hr("=")
    p.line(payload.get("footer") or "Vielen Dank für Ihren Einkauf!")
    p.line(format_datetime(payload.get("date")))
    p.line()
    p.feed(FEED_LINES)
    p.cut()

    copies = max(1, min(5, int(payload.get("copies") or 1)))
    buf = p.build()
    return buf * copies


def render_text(text: str, cut: bool = True, copies: int = 1, charset: str | None = None) -> bytes:
    p = EscPos(WIDTH, charset)
    p.init().codepage()
    for line in str(text).split("\n"):
        p.line(line)
    p.feed(FEED_LINES)
    if cut:
        p.cut()
    buf = p.build()
    n = max(1, min(5, int(copies or 1)))
    return buf * n


# ---------------------------------------------------------------------------
# Block-Rendering (für den Bon-Designer)
# ---------------------------------------------------------------------------

SIZES = {"normal": 0x00, "tall": 0x10, "wide": 0x01, "double": 0x11}
_EC = {"L": 48, "M": 49, "Q": 50, "H": 51}


def qr_commands(p: "EscPos", data, module: int = 5, ec: str = "M") -> None:
    """Nativen ESC/POS-QR-Code (Modell 2) anfügen."""
    d = str(data).encode("utf-8")
    n = len(d) + 3
    pl, ph = n & 0xFF, (n >> 8) & 0xFF
    p.raw([GS, 0x28, 0x6B, 4, 0, 0x31, 0x41, 0x32, 0x00])  # Modell 2
    p.raw([GS, 0x28, 0x6B, 3, 0, 0x31, 0x43, max(1, min(16, int(module)))])  # Modulgröße
    p.raw([GS, 0x28, 0x6B, 3, 0, 0x31, 0x45, _EC.get(str(ec).upper(), 49)])  # Fehlerkorrektur
    p.raw([GS, 0x28, 0x6B, pl, ph, 0x31, 0x50, 0x30])  # Daten speichern
    p.raw(d)
    p.raw([GS, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30])  # Drucken


def barcode_commands(p: "EscPos", data, height: int = 60, width: int = 2, hri: int = 2) -> None:
    """CODE128-Barcode (GS k 73) anfügen."""
    p.raw([GS, 0x68, max(1, min(255, int(height)))])  # GS h  Höhe
    p.raw([GS, 0x77, max(2, min(6, int(width)))])  # GS w  Modulbreite
    p.raw([GS, 0x48, max(0, min(3, int(hri)))])  # GS H  Klartextposition
    d = str(data).encode("ascii", "replace")
    p.raw([GS, 0x6B, 73, len(d)])  # GS k 73 n
    p.raw(d)


def render_blocks(payload: dict | None = None) -> bytes:
    """Rendert eine freie Liste von Design-Blöcken als ESC/POS.

    payload: { width, charset, copies, blocks: [ {type, ...}, ... ] }

    Blocktypen:
      text    {text, align, size: normal|tall|wide|double, bold, underline}
      cols    {left, right}
      hr      {char}
      qr      {data, size (Modul 1-16), ec: L|M|Q|H, align}
      barcode {data, height, width, hri, align}
      feed    {lines}
      cut     {}
      raw     {text}
    """
    payload = payload or {}
    width = int(payload.get("width") or WIDTH) or WIDTH
    cs = _pick_charset(payload)
    blocks = payload.get("blocks") if isinstance(payload.get("blocks"), list) else []
    p = EscPos(width, cs)
    p.init().codepage()

    cut_done = False
    for b in blocks:
        if not isinstance(b, dict):
            continue
        t = str(b.get("type") or "text")
        align = str(b.get("align") or "")
        if align in ("left", "center", "right"):
            p.align(align)

        if t == "text":
            p.bold(bool(b.get("bold")))
            if b.get("underline"):
                p.raw([ESC, 0x2D, 1])
            p.size(SIZES.get(str(b.get("size", "normal")).lower(), 0x00))
            p.line(str(b.get("text", "")))
            p.size(0x00)
            p.bold(False)
            if b.get("underline"):
                p.raw([ESC, 0x2D, 0])
        elif t == "cols":
            p.cols(str(b.get("left", "")), str(b.get("right", "")))
        elif t == "hr":
            ch = str(b.get("char") or "-")[:1] or "-"
            p.hr(ch)
        elif t == "qr":
            p.align(align or "center")
            qr_commands(p, b.get("data", ""), b.get("size", 5), b.get("ec", "M"))
        elif t == "barcode":
            p.align(align or "center")
            barcode_commands(p, b.get("data", ""), b.get("height", 60),
                             b.get("width", 2), b.get("hri", 2))
        elif t == "feed":
            p.feed(int(b.get("lines", 1)))
        elif t == "cut":
            p.cut()
            cut_done = True
        elif t == "raw":
            p.line(str(b.get("text", "")))

    if not cut_done:
        p.feed(FEED_LINES)
        p.cut()

    copies = max(1, min(5, int(payload.get("copies") or 1)))
    buf = p.build()
    return buf * copies


# ---------------------------------------------------------------------------
# An den Drucker senden
# ---------------------------------------------------------------------------

class PrinterError(RuntimeError):
    pass


def send_to_printer(data: bytes) -> None:
    if PRINTER_MODE == "device":
        try:
            with open(PRINTER_DEVICE, "wb") as fh:
                fh.write(data)
        except OSError as err:
            raise PrinterError(f"Schreiben auf {PRINTER_DEVICE} fehlgeschlagen: {err}") from err
        return

    # CUPS: roh senden, damit keine Filter die ESC/POS-Bytes verändern.
    try:
        proc = subprocess.run(
            [LP_BIN, "-d", PRINTER_NAME, "-o", "raw"],
            input=data,
            capture_output=True,
            timeout=30,
        )
    except FileNotFoundError as err:
        raise PrinterError(f"{LP_BIN} nicht gefunden.") from err
    except subprocess.TimeoutExpired as err:
        raise PrinterError("Zeitüberschreitung beim Senden an den Drucker.") from err

    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or b"").decode("utf-8", "replace").strip()
        raise PrinterError(f"{LP_BIN} beendet mit Code {proc.returncode}: {msg}")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "fyndo-print/1.0"

    def _send(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status: int, data: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("Anfrage zu groß.")
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def log_message(self, fmt, *args):
        sys.stderr.write("[fyndo-print] " + (fmt % args) + "\n")

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path in ("/", "/health"):
            self._send(200, {
                "ok": True,
                "service": "fyndo-print",
                "printer": PRINTER_NAME,
                "mode": PRINTER_MODE,
                "device": PRINTER_DEVICE if PRINTER_MODE == "device" else None,
                "width": WIDTH,
                "charset": CHARSET,
                "cut": CUT_MODE,
                "endpoints": ["/health", "/printers", "/qr.png", "/designer", "/print", "/print/text",
                              "/print/raw", "/print/blocks", "/test"],
            })
            return
        if path == "/qr.png":
            qs = parse_qs(urlparse(self.path).query)
            data = (qs.get("data") or [""])[0]
            if not data:
                self._send(400, {"ok": False, "error": "Parameter 'data' fehlt."})
                return
            try:
                size = int((qs.get("size") or ["4"])[0])
            except ValueError:
                size = 4
            size = max(1, min(16, size))
            try:
                proc = subprocess.run(
                    [QRENCODE_BIN, "-o", "-", "-t", "PNG", "-s", str(size), "-m", "2", data],
                    capture_output=True, timeout=10,
                )
            except FileNotFoundError:
                self._send(500, {"ok": False, "error": f"{QRENCODE_BIN} nicht installiert."})
                return
            if proc.returncode != 0:
                self._send(500, {"ok": False, "error": (proc.stderr or b"").decode("utf-8", "replace").strip()})
                return
            self._send_bytes(200, proc.stdout, "image/png")
            return
        if path in ("/designer", "/bon-designer", "/bon-designer.html"):
            designer = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bon-designer.html")
            try:
                with open(designer, "rb") as fh:
                    html = fh.read()
            except OSError:
                self._send(404, {"ok": False, "error": "bon-designer.html nicht gefunden."})
                return
            self._send_bytes(200, html, "text/html; charset=utf-8")
            return
        if path == "/printers":
            try:
                proc = subprocess.run([LPSTAT_BIN, "-p", "-d"], capture_output=True, timeout=10)
                self._send(200, {"ok": True, "printers": proc.stdout.decode("utf-8", "replace").strip()})
            except Exception as err:  # noqa: BLE001
                self._send(200, {"ok": False, "error": str(err)})
            return
        self._send(404, {"ok": False, "error": "Unbekannter Endpunkt."})

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
            if path == "/print":
                payload = self._read_json()
                data = render_receipt(payload)
                send_to_printer(data)
                self._send(200, {"ok": True, "bytes": len(data),
                                 "orderNumber": payload.get("orderNumber")})
                return

            if path == "/print/blocks":
                payload = self._read_json()
                data = render_blocks(payload)
                send_to_printer(data)
                self._send(200, {
                    "ok": True,
                    "bytes": len(data),
                    "blocks": len(payload.get("blocks") or []),
                })
                return

            if path == "/print/text":
                payload = self._read_json()
                text = str(payload.get("text") or "")
                if not text:
                    self._send(400, {"ok": False, "error": "Feld 'text' fehlt."})
                    return
                data = render_text(text, cut=payload.get("cut", True) is not False,
                                   copies=payload.get("copies", 1),
                                   charset=_pick_charset(payload))
                send_to_printer(data)
                self._send(200, {"ok": True, "bytes": len(data)})
                return

            if path == "/print/raw":
                payload = self._read_json()
                b64 = payload.get("base64")
                if not isinstance(b64, str) or not b64:
                    self._send(400, {"ok": False, "error": "Feld 'base64' fehlt."})
                    return
                data = base64.b64decode(b64)
                send_to_printer(data)
                self._send(200, {"ok": True, "bytes": len(data)})
                return

            if path == "/test":
                try:
                    payload = self._read_json()
                except Exception:  # noqa: BLE001
                    payload = {}
                data = render_receipt({
                    "vendorName": payload.get("vendorName") or "TESTDRUCK",
                    "header": "TESTBON",
                    "orderNumber": payload.get("orderNumber") or 42,
                    "date": datetime.now().isoformat(),
                    "charset": payload.get("charset"),
                    "width": payload.get("width"),
                    "items": [
                        {"qty": 1, "name": "Testartikel A", "amountCents": 250},
                        {"qty": 2, "name": "Testartikel mit sehr langem Namen B", "amountCents": 500},
                        {"qty": 1, "name": "Grüße äöüß ÄÖÜ", "amountCents": 100},
                    ],
                    "subtotalCents": 850,
                    "totalCents": 850,
                    "paymentMethod": "CASH",
                    "footer": "Drucker funktioniert. Vielen Dank!",
                })
                send_to_printer(data)
                self._send(200, {"ok": True, "bytes": len(data)})
                return

            self._send(404, {"ok": False, "error": "Unbekannter Endpunkt."})
        except PrinterError as err:
            self._send(500, {"ok": False, "error": str(err)})
        except Exception as err:  # noqa: BLE001
            self._send(400, {"ok": False, "error": str(err)})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[fyndo-print] Druckserver läuft auf http://{HOST}:{PORT}")
    print(f"[fyndo-print] Drucker: {PRINTER_NAME} (Modus: {PRINTER_MODE}), "
          f"Breite: {WIDTH}, Charset: {CHARSET}, Schnitt: {CUT_MODE}")
    print(f"[fyndo-print] Bon-Designer: printer/bon-designer.html im Browser öffnen")
    print(f"[fyndo-print] Test: curl -X POST http://localhost:{PORT}/test")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[fyndo-print] Beende …")
        server.shutdown()


if __name__ == "__main__":
    main()
