"""
Experiment document export
==========================
Takes the student's own experiment .docx, finds its Observation Table, and
inserts a "Result & Graph" section immediately below it containing:

  - the readings actually measured in the app (a real Word table), and
  - the chart rendered in the browser (PNG).

The upload/modify/download round-trip is deliberate: every student has their own
copy of the document, so rather than shipping a template that would drift out of
sync with the syllabus, we edit the exact file they hand us and give it straight
back. The original file on disk is never touched — we work on the uploaded bytes
and return a new document.
"""

import io
import json
from datetime import datetime
from typing import Optional

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()

# Header text that identifies the Observation Table in the syllabus document.
_TABLE_MARKERS = ("reading no", "distance", "signal strength")


def _find_observation_table(doc: Document):
    """
    Locates the Observation Table. Matches on header text rather than position
    so it still works if the student's copy has extra tables or reordered
    sections; falls back to the first table in the document.
    """
    for table in doc.tables:
        if not table.rows:
            continue
        header = " | ".join(c.text.strip().lower() for c in table.rows[0].cells)
        if sum(m in header for m in _TABLE_MARKERS) >= 2:
            return table
    return doc.tables[0] if doc.tables else None


def _style_header_cell(cell) -> None:
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True
            run.font.size = Pt(9)


def _apply_grid_borders(table) -> None:
    """
    Draws borders via direct XML rather than a named style.

    Not every .docx defines the built-in "Table Grid" style — python-docx raises
    KeyError if it is missing, and student copies of the syllabus document vary.
    Writing w:tblBorders directly always works, whatever styles the document has.
    """
    tblPr = table._element.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "808080")
        borders.append(el)
    tblPr.append(borders)


def _quality(rssi) -> str:
    """
    Labels a measured RSSI, using the same thresholds as the signal badges in
    the web app so the document matches what the student saw on screen.

    Derived here because a reading only carries the measured values (rssi,
    signal_pct, ssid, channel) — there is no 'quality' field to read.
    """
    try:
        v = float(rssi)
    except (TypeError, ValueError):
        return ""
    if v >= -50:
        return "Excellent"
    if v >= -60:
        return "Good"
    if v >= -70:
        return "Fair"
    return "Poor"


def _num(value) -> str:
    """Formats a measured number without a pointless trailing '.0'."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "" if value is None else str(value)
    return str(int(v)) if v == int(v) else f"{v:g}"


def _build_readings_table(doc: Document, readings: list, style_hint=None) -> "object":
    """Creates (at the end of the body) a Word table of the measured readings."""
    cols = ["Reading No.", "Distance (m)", "RSSI (dBm)", "Signal (%)", "Quality", "Network"]
    table = doc.add_table(rows=1, cols=len(cols))

    # Prefer the document's own Observation-Table style so the inserted table
    # looks native; fall back to Table Grid; borders are drawn regardless.
    for candidate in (style_hint, "Table Grid"):
        if not candidate:
            continue
        try:
            table.style = candidate
            break
        except (KeyError, ValueError):
            continue
    _apply_grid_borders(table)

    hdr = table.rows[0].cells
    for i, name in enumerate(cols):
        hdr[i].text = name
        _style_header_cell(hdr[i])

    for idx, r in enumerate(readings, start=1):
        row = table.add_row().cells
        row[0].text = str(idx)
        row[1].text = _num(r.get("distance"))
        row[2].text = _num(r.get("rssi"))
        row[3].text = _num(r.get("signal_pct"))
        row[4].text = str(r.get("quality") or _quality(r.get("rssi")))
        row[5].text = str(r.get("ssid", ""))
        for c in row:
            for p in c.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
    return table


def _summary_sentence(readings: list) -> str:
    vals = [r.get("rssi") for r in readings if isinstance(r.get("rssi"), (int, float))]
    dists = [r.get("distance") for r in readings if isinstance(r.get("distance"), (int, float))]
    if not vals or not dists:
        return "Measured Wi-Fi signal strength at multiple distances from the access point."
    return (
        f"Across {len(readings)} readings taken between {min(dists):g} m and {max(dists):g} m, "
        f"the measured RSSI ranged from {max(vals):g} dBm (strongest) to {min(vals):g} dBm "
        f"(weakest), a total variation of {abs(max(vals) - min(vals)):g} dB. This confirms the "
        f"inverse, non-linear relationship between received signal strength and distance "
        f"described by the log-distance path loss model."
    )


@router.post("/export")
async def export_to_document(
    document: UploadFile = File(...),
    readings: str = Form(...),
    chart: Optional[UploadFile] = File(None),
    heading: str = Form("Result & Graph"),
    experiment: str = Form("Experiment 4 - Wi-Fi Signal Strength vs Distance"),
):
    """
    Inserts a "Result & Graph" section below the Observation Table of the
    uploaded .docx and returns the modified document.
    """
    if not document.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Please upload a .docx file (not .doc or .pdf).")

    try:
        rows = json.loads(readings)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Readings payload was not valid JSON.")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="No readings to export.")

    raw = await document.read()
    try:
        doc = Document(io.BytesIO(raw))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not open that file as a Word document. Make sure it is a valid .docx.",
        )

    anchor_table = _find_observation_table(doc)
    if anchor_table is None:
        raise HTTPException(
            status_code=422,
            detail="No Observation Table found in the document, so there is nowhere to insert the results.",
        )

    # --- Build the new content at the end of the body, then relocate it ---
    built = []

    h = doc.add_paragraph()
    hr = h.add_run(heading)
    hr.bold = True
    hr.font.size = Pt(14)
    hr.font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
    built.append(h)

    meta = doc.add_paragraph()
    mr = meta.add_run(
        f"{experiment} · Recorded {len(rows)} live readings · "
        f"Generated {datetime.now().strftime('%d %B %Y, %H:%M')}"
    )
    mr.italic = True
    mr.font.size = Pt(9)
    built.append(meta)

    try:
        style_hint = anchor_table.style
    except Exception:
        style_hint = None
    tbl = _build_readings_table(doc, rows, style_hint=style_hint)
    built.append(tbl)

    built.append(doc.add_paragraph())  # spacer

    if chart is not None:
        img_bytes = await chart.read()
        if img_bytes:
            cap = doc.add_paragraph()
            cr = cap.add_run("Graph: Signal Strength vs Distance")
            cr.bold = True
            cr.font.size = Pt(10)
            built.append(cap)

            pic_para = doc.add_paragraph()
            pic_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            try:
                pic_para.add_run().add_picture(io.BytesIO(img_bytes), width=Inches(6.0))
            except Exception:
                # A bad/empty image must not lose the table the student just measured.
                pic_para.add_run("[Chart image could not be embedded]").italic = True
            built.append(pic_para)

    obs = doc.add_paragraph()
    obs.add_run("Observation: ").bold = True
    obs.add_run(_summary_sentence(rows))
    built.append(obs)

    built.append(doc.add_paragraph())  # trailing spacer

    # --- Move the built blocks to sit directly beneath the Observation Table ---
    anchor = anchor_table._element
    for block in built:
        el = block._element
        anchor.addnext(el)
        anchor = el

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)

    base = document.filename[:-5] if document.filename.lower().endswith(".docx") else document.filename
    filename = f"{base} - with Results.docx"

    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
