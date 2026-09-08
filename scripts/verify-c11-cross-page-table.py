#!/usr/bin/env python3
"""
verify-c11-cross-page-table.py — C11 跨頁表格與標題重複測試
產生含 60 列長表之 fixture PDF，強制跨頁，驗證：
1. 頁數 > 1（表格確實跨頁）
2. 表頭在每一頁重複（repeatRows=1）
3. 首尾列內容完整（無裁切遺漏）
"""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle as PS

FONT = "/tmp/v41-qa/fonts/NotoSansTC-Regular.ttf"
OUT = "/home/node/dev/repo/tmp-v41-fixture/fixture_crosstab_TC.pdf"

pdfmetrics.registerFont(TTFont("NotoTC", FONT))

doc = SimpleDocTemplate(OUT, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
title = PS(name="T", fontName="NotoTC", fontSize=14, leading=18)
warn = PS(name="W", fontName="NotoTC", fontSize=8, textColor=colors.grey)
cell = PS(name="C", fontName="NotoTC", fontSize=9, leading=12)

story = [
    Paragraph("合成示範：跨頁表格渲染測試（C11）", title),
    Paragraph("合成示範文件 — 供平台匯出功能驗收之用，非真實送件文件。", warn),
    Spacer(1, 12),
]

# 60 列長表 → 必然跨頁
data = [["項目編號", "測量值 (ms)", "標準差", "備註"]]
for i in range(1, 61):
    data.append([f"P-{i:03d}", f"{3421.5 - i*7.3:.2f}", f"{56.8 + i*0.4:.2f}", "合成示範資料" if i % 10 == 0 else "—"])

tbl = Table(data, colWidths=[3*cm, 4*cm, 3*cm, 5*cm], repeatRows=1)
tbl.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), "NotoTC"), ("FONTSIZE", (0,0), (-1,-1), 9),
    ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
    ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
]))
story.append(tbl)
story.append(Spacer(1, 10))
story.append(Paragraph("表一（合成示範）：60 列長表，驗證跨頁與表頭重複。", warn))

doc.build(story)

# QA: pypdf 驗證
from pypdf import PdfReader
r = PdfReader(OUT)
pages = len(r.pages)
per_page = [p.extract_text() or "" for p in r.pages]
header_pages = sum(1 for t in per_page if "項目編號" in t)
first_row_ok = any("P-001" in t for t in per_page)
last_row_ok = any("P-060" in t for t in per_page)

fails = 0
def check(name, ok, detail=""):
    global fails
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not ok: fails += 1

check("pages > 1 (table actually spans)", pages > 1, f"pages={pages}")
check("header repeats on every page", header_pages == pages, f"header on {header_pages}/{pages} pages")
check("first row P-001 present", first_row_ok)
check("last row P-060 present (no clipping)", last_row_ok)
check("disclaimer present", any("合成示範" in t for t in per_page))

print(f"\n檔案: {OUT} pages={pages}")
sys.exit(0 if fails == 0 else 1)
