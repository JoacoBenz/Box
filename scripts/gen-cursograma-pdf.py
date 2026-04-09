"""
Cursograma profesional para presentación al cliente.
Flujo vertical centrado, flechas ortogonales, sin superposiciones.
"""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
import math

W, H = A4
OUTPUT = "D:\\BoxZenj\\compras-escolar\\docs\\cursograma-proceso.pdf"
c = canvas.Canvas(OUTPUT, pagesize=A4)
c.setTitle("Cursograma - Proceso de Solicitud de Compra")

# ── PALETTE ──
C_SOL   = HexColor("#2563eb")
C_RESP  = HexColor("#7c3aed")
C_DIR   = HexColor("#d97706")
C_COMP  = HexColor("#059669")
C_TES   = HexColor("#0891b2")
C_TERM  = HexColor("#dc2626")
C_DEV   = HexColor("#ea580c")
C_GRAY  = HexColor("#64748b")

B_SOL   = HexColor("#dbeafe")
B_RESP  = HexColor("#ede9fe")
B_DIR   = HexColor("#fef3c7")
B_COMP  = HexColor("#d1fae5")
B_TES   = HexColor("#cffafe")
B_TERM  = HexColor("#fee2e2")
B_DEV   = HexColor("#fff7ed")
B_GRAY  = HexColor("#f1f5f9")

BLACK   = HexColor("#0f172a")
DGRAY   = HexColor("#334155")
LGRAY   = HexColor("#94a3b8")

# ── GEOMETRY ──
CX    = W / 2          # center of page
BW    = 155            # box width
BH    = 32             # box height
DW    = 140            # diamond width
DH    = 40             # diamond height
GAP   = 46             # vertical gap between rows
LX    = CX - 155       # left branch X
RX    = CX + 155       # right branch X
FAR_L = 38             # far left guide for return arrows

def Y(n): return H - 62 - n * GAP   # row Y position

# ══════════════════════════════════════
# DRAWING PRIMITIVES
# ══════════════════════════════════════

def _head(x, y, ang, col, s=6):
    c.setFillColor(col)
    p = c.beginPath()
    p.moveTo(x, y)
    p.lineTo(x - s*math.cos(ang-.35), y - s*math.sin(ang-.35))
    p.lineTo(x - s*math.cos(ang+.35), y - s*math.sin(ang+.35))
    p.close(); c.drawPath(p, fill=1, stroke=0)

def _line(x1,y1,x2,y2, col=C_GRAY, w=1.3, dash=False):
    c.setStrokeColor(col); c.setLineWidth(w)
    c.setDash(5,3) if dash else c.setDash()
    c.line(x1,y1,x2,y2); c.setDash()

def arrow_v(x, y1, y2, col=C_GRAY):
    _line(x, y1, x, y2, col)
    _head(x, y2, -math.pi/2 if y2<y1 else math.pi/2, col)

def arrow_h(y, x1, x2, col=C_GRAY):
    _line(x1, y, x2, y, col)
    _head(x2, y, 0 if x2>x1 else math.pi, col)

def box(x, y, txt, bg, col, fs=9, bold=True):
    c.setStrokeColor(col); c.setFillColor(bg); c.setLineWidth(1.6)
    c.roundRect(x-BW/2, y-BH/2, BW, BH, 6, fill=1, stroke=1)
    fn = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(fn, fs); c.setFillColor(BLACK)
    lines = txt.split("\n"); lh = fs + 2.5
    for i, l in enumerate(lines):
        tw = c.stringWidth(l, fn, fs)
        ly = y + (len(lines)-1)*lh/2 - i*lh - 3
        c.drawString(x - tw/2, ly, l)

def diamond(x, y, txt, bg, col, fs=8):
    c.setStrokeColor(col); c.setFillColor(bg); c.setLineWidth(1.6)
    p = c.beginPath()
    p.moveTo(x, y+DH/2); p.lineTo(x+DW/2, y)
    p.lineTo(x, y-DH/2); p.lineTo(x-DW/2, y); p.close()
    c.drawPath(p, fill=1, stroke=1)
    c.setFillColor(BLACK); c.setFont("Helvetica-Bold", fs)
    lines = txt.split("\n"); lh = fs + 2.5
    for i, l in enumerate(lines):
        tw = c.stringWidth(l, "Helvetica-Bold", fs)
        c.drawString(x-tw/2, y+(len(lines)-1)*lh/2 - i*lh - 2, l)

def circ(x, y, txt, bg, col, r=14):
    c.setStrokeColor(col); c.setFillColor(bg); c.setLineWidth(2)
    c.circle(x, y, r, fill=1, stroke=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 9)
    tw = c.stringWidth(txt, "Helvetica-Bold", 9)
    c.drawString(x-tw/2, y-3.5, txt)

def tag(x, y, txt, col, align="r", fs=7):
    """Role tag — italic, no overlap."""
    c.setFont("Helvetica-Oblique", fs); c.setFillColor(col)
    if align == "r": c.drawRightString(x, y, txt)
    elif align == "l": c.drawString(x, y, txt)
    else:
        tw = c.stringWidth(txt, "Helvetica-Oblique", fs)
        c.drawString(x - tw/2, y, txt)

def lbl(x, y, txt, col=DGRAY, fs=7, align="l"):
    """Small label for arrows."""
    c.setFont("Helvetica", fs); c.setFillColor(col)
    if align == "r": c.drawRightString(x, y, txt)
    elif align == "c":
        tw = c.stringWidth(txt, "Helvetica", fs)
        c.drawString(x-tw/2, y, txt)
    else: c.drawString(x, y, txt)

# ══════════════════════════════════════
# TITLE
# ══════════════════════════════════════
c.setFont("Helvetica-Bold", 17); c.setFillColor(BLACK)
c.drawCentredString(CX, H - 30, "Cursograma — Proceso de Solicitud de Compra")

# ── LEGEND (top-right, vertical, in a box) ──
ref_x = W - 25
ref_top = H - 52
ref_items = [
    ("Solicitante", C_SOL, B_SOL),
    ("Resp. de Area", C_RESP, B_RESP),
    ("Director/a", C_DIR, B_DIR),
    ("Compras", C_COMP, B_COMP),
    ("Tesoreria", C_TES, B_TES),
    ("Estado terminal", C_TERM, B_TERM),
    ("Devolucion", C_DEV, B_DEV),
]
# Background box for legend
lbg_h = len(ref_items) * 15 + 20
c.setFillColor(HexColor("#f8fafc")); c.setStrokeColor(HexColor("#e2e8f0")); c.setLineWidth(0.8)
c.roundRect(ref_x - 95, ref_top - lbg_h + 15, 100, lbg_h, 5, fill=1, stroke=1)
c.setFont("Helvetica-Bold", 7.5); c.setFillColor(DGRAY)
c.drawRightString(ref_x - 5, ref_top, "REFERENCIAS")
for i, (name, col, bg) in enumerate(ref_items):
    iy = ref_top - 14 - i * 15
    c.setFillColor(bg); c.setStrokeColor(col); c.setLineWidth(1)
    c.rect(ref_x - 90, iy - 1, 11, 11, fill=1, stroke=1)
    c.setFillColor(DGRAY); c.setFont("Helvetica", 7.5)
    c.drawString(ref_x - 76, iy, name)

# ══════════════════════════════════════
# FLOW (16 rows, 0-15)
# ══════════════════════════════════════

# ── 0: INICIO ──
circ(CX, Y(0), "Inicio", HexColor("#16a34a"), HexColor("#15803d"))

# ── 1: CREAR SOLICITUD ──
box(CX, Y(1), "Crear solicitud (borrador)", B_SOL, C_SOL)
arrow_v(CX, Y(0)-14, Y(1)+BH/2, C_SOL)
tag(CX - BW/2 - 6, Y(1)-3, "Solicitante", C_SOL)

# ── 2: ENVIAR ──
box(CX, Y(2), "Enviar solicitud", B_SOL, C_SOL)
arrow_v(CX, Y(1)-BH/2, Y(2)+BH/2, C_SOL)

# ── 3: DECISION AUTO-VALIDACION ──
diamond(CX, Y(3), "Es Responsable\nde Area?", B_SOL, C_SOL)
arrow_v(CX, Y(2)-BH/2, Y(3)+DH/2, C_SOL)

# SI -> right, down to VALIDADA (row 6)
si_x = CX + DW/2
_line(si_x, Y(3), RX, Y(3), C_SOL)
_line(RX, Y(3), RX, Y(6)+BH/2, C_SOL)
_head(RX, Y(6)+BH/2, -math.pi/2, C_SOL)
lbl(si_x + 6, Y(3) + 4, "SI", C_SOL, 8)
lbl(RX + 5, (Y(3)+Y(6))/2, "auto-valida", C_SOL, 6)

# NO -> down to Validar (row 4)
box(CX, Y(4), "Validar solicitud", B_RESP, C_RESP)
arrow_v(CX, Y(3)-DH/2, Y(4)+BH/2, C_RESP)
lbl(CX + 5, Y(3)-DH/2 + 6, "NO", C_RESP, 8)
tag(CX - BW/2 - 6, Y(4)-3, "Resp. de Area", C_RESP)

# ── 5: DEVOLVER POR RESPONSABLE (left branch) ──
box(LX, Y(5), "Devolver con obs.", B_DEV, C_DEV, fs=8)
# Arrow left from Validar box
_line(CX - BW/2, Y(4)-4, LX + BW/2, Y(4)-4, C_DEV)
arrow_v(LX, Y(4)-4, Y(5)+BH/2, C_DEV)
lbl(CX - BW/2 - 4, Y(4), "devuelve", C_DEV, 6, "r")

# Return: Devuelta_resp -> re-envia a Enviar (row 2)
_line(LX - BW/2, Y(5), FAR_L, Y(5), C_DEV)
_line(FAR_L, Y(5), FAR_L, Y(2), C_DEV)
arrow_h(Y(2), FAR_L, CX - BW/2, C_DEV)
lbl(FAR_L + 4, (Y(5)+Y(3))/2, "re-envia", C_DEV, 6)

# Validar -> VALIDADA: bypass right side
# ── 6: VALIDADA ──
box(CX, Y(6), "VALIDADA", B_GRAY, C_GRAY, fs=11)
# Right-side bypass from Validar (row 4) to Validada (row 6)
bx = CX + BW/2 + 10
_line(CX + BW/2, Y(4)+4, bx, Y(4)+4, C_RESP)
_line(bx, Y(4)+4, bx, Y(6)+BH/2+4, C_RESP)
_line(bx, Y(6)+BH/2+4, CX + BW/2, Y(6)+BH/2+4, C_RESP)
_head(CX + BW/2, Y(6)+BH/2+4, math.pi, C_RESP)
lbl(bx + 4, (Y(4)+Y(6))/2 + 10, "valida", C_RESP, 6)

# Auto-valida arrow arrives from right
_line(RX, Y(6)+BH/2, CX+BW/2, Y(6)+BH/2, C_SOL)

# ── 7: DIRECTOR REVISA ──
diamond(CX, Y(7), "Director/a revisa", B_DIR, C_DIR, fs=9)
arrow_v(CX, Y(6)-BH/2, Y(7)+DH/2, C_GRAY)
tag(CX - DW/2 - 6, Y(7)-3, "Director/a", C_DIR)

# LEFT: Devolver por director
box(LX, Y(8), "Devolver con obs.", B_DEV, C_DEV, fs=8)
_line(CX - DW/2, Y(7), LX, Y(7), C_DEV)
arrow_v(LX, Y(7), Y(8)+BH/2, C_DEV)
lbl(CX - DW/2 - 4, Y(7)+4, "devuelve", C_DEV, 6, "r")

# Return: Devuelta_dir -> re-envia
_line(LX - BW/2, Y(8), FAR_L - 10, Y(8), C_DEV)
_line(FAR_L - 10, Y(8), FAR_L - 10, Y(2), C_DEV)
arrow_h(Y(2), FAR_L - 10, CX - BW/2, C_DEV)
lbl(FAR_L - 6, (Y(8)+Y(5))/2, "re-envia", C_DEV, 6)

# RIGHT: Rechazar
box(RX, Y(8), "RECHAZADA", B_TERM, C_TERM, fs=9)
_line(CX + DW/2, Y(7), RX, Y(7), C_TERM)
arrow_v(RX, Y(7), Y(8)+BH/2, C_TERM)
lbl(CX + DW/2 + 6, Y(7)+4, "rechaza", C_TERM, 7)

# DOWN: Aprueba
lbl(CX + 5, Y(7)-DH/2 + 6, "aprueba", C_DIR, 7)

# ── 9: EN_COMPRAS ──
box(CX, Y(9), "EN_COMPRAS", B_GRAY, C_GRAY, fs=11)
arrow_v(CX, Y(7)-DH/2, Y(9)+BH/2, C_DIR)

# ── 10: PROCESAR ──
box(CX, Y(10), "Procesar solicitud\nprioridad + dia de pago", B_COMP, C_COMP, fs=8)
arrow_v(CX, Y(9)-BH/2, Y(10)+BH/2, C_COMP)
tag(CX - BW/2 - 6, Y(10)-3, "Compras", C_COMP)

# ── 11: PAGO_PROGRAMADO ──
box(CX, Y(11), "PAGO_PROGRAMADO", B_GRAY, C_GRAY, fs=10)
arrow_v(CX, Y(10)-BH/2, Y(11)+BH/2, C_COMP)

# ── 12: REGISTRAR COMPRA ──
box(CX, Y(12), "Registrar compra\ncomprobante + monto", B_TES, C_TES, fs=8)
arrow_v(CX, Y(11)-BH/2, Y(12)+BH/2, C_TES)
tag(CX - BW/2 - 6, Y(12)-3, "Tesoreria", C_TES)

# ── 13: ABONADA ──
box(CX, Y(13), "ABONADA", B_GRAY, C_GRAY, fs=11)
arrow_v(CX, Y(12)-BH/2, Y(13)+BH/2, C_TES)

# ── 14: RECEPCION ──
diamond(CX, Y(14), "Recepcion\nconforme?", B_SOL, C_SOL, fs=8)
arrow_v(CX, Y(13)-BH/2, Y(14)+DH/2, C_SOL)
tag(CX - DW/2 - 6, Y(14)-3, "Solicitante", C_SOL)

# Conforme -> CERRADA
box(CX, Y(15), "CERRADA", B_TERM, C_TERM, fs=11)
arrow_v(CX, Y(14)-DH/2, Y(15)+BH/2, C_TERM)
lbl(CX + 5, Y(14)-DH/2 + 6, "SI, conforme", HexColor("#16a34a"), 7)

# No conforme -> RECIBIDA_CON_OBS (right)
box(RX, Y(15), "RECIBIDA\nCON OBS.", B_DEV, C_DEV, fs=8)
_line(CX + DW/2, Y(14), RX, Y(14), C_DEV)
arrow_v(RX, Y(14), Y(15)+BH/2, C_DEV)
lbl(CX + DW/2 + 6, Y(14)+4, "NO, con observaciones", C_DEV, 6)

# Obs -> resuelve -> cerrada
arrow_h(Y(15), RX - BW/2, CX + BW/2, C_TERM)
lbl((CX+RX)/2, Y(15)+5, "resuelve y cierra", C_TERM, 6, "c")

# ── 16: FIN ──
circ(CX, Y(16), "Fin", C_TERM, C_TERM)
arrow_v(CX, Y(15)-BH/2, Y(16)+14, C_TERM)

# ══════════════════════════════════════
# ANULACION (clean, single note on right)
# ══════════════════════════════════════
# Instead of messy dashed lines, show a clean annotation
anul_y = (Y(9) + Y(11)) / 2
anul_x = W - 45

# ANULADA box
c.setStrokeColor(C_TERM); c.setFillColor(B_TERM); c.setLineWidth(1.5)
c.roundRect(anul_x - 42, anul_y - 14, 84, 28, 5, fill=1, stroke=1)
c.setFont("Helvetica-Bold", 9); c.setFillColor(BLACK)
c.drawCentredString(anul_x, anul_y - 3, "ANULADA")

# Single clean dashed line from main flow
mid_x = CX + BW/2 + 20
_line(mid_x, anul_y, anul_x - 42, anul_y, C_TERM, 1, dash=True)
_head(anul_x - 42, anul_y, 0, C_TERM, 5)

# Bracket on left side of dashed line showing which states
bracket_top = Y(2) - BH/2
bracket_bot = Y(11) + BH/2
c.setStrokeColor(C_TERM); c.setLineWidth(0.8); c.setDash(4, 3)
c.line(mid_x, bracket_top, mid_x, bracket_bot)
c.setDash()
# Small ticks
for r in [2, 6, 9, 11]:
    ty = Y(r)
    _line(CX + BW/2, ty, mid_x, ty, C_TERM, 0.8, dash=True)

# Annotation text
c.setFont("Helvetica", 6); c.setFillColor(C_TERM)
c.drawCentredString(anul_x, anul_y - 22, "desde: ENVIADA,")
c.drawCentredString(anul_x, anul_y - 30, "VALIDADA, EN_COMPRAS,")
c.drawCentredString(anul_x, anul_y - 38, "PAGO_PROGRAMADO")
c.setFont("Helvetica-Oblique", 5.5); c.setFillColor(LGRAY)
c.drawCentredString(anul_x, anul_y - 48, "solicitante (propias),")
c.drawCentredString(anul_x, anul_y - 55, "director/a, admin")

# ── FOOTER ──
c.setFont("Helvetica", 6); c.setFillColor(LGRAY)
c.drawCentredString(CX, 15, "Estados terminales: RECHAZADA · ANULADA · CERRADA")

c.save()
print("PDF generado:", OUTPUT)
