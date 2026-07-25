"""
Experiment document export
==========================
Finds the Observation Table of the experiment document and inserts a
"Result & Graph" section immediately below it containing:

  - the readings actually measured in the app (a real Word table), and
  - the chart rendered in the browser (PNG).

The experiment document is bundled with the backend (see assets/), so the
student just clicks "Add to Document" and downloads the finished file — no
upload step. The bundled bytes are read fresh on every request and never
modified; each export produces a brand-new document. An uploaded .docx is still
accepted (optional) for flexibility, but the app no longer requires one.
"""

import io
import json
import os
import sys
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

# Experiment key -> bundled template filename (in assets/). The template is the
# blank syllabus document; the export inserts the Result & Graph section below
# its Observation Table, so students never upload anything.
_TEMPLATES = {
    "exp4": "Expt. No. 4.docx",
}


def _assets_dir() -> str:
    """
    Directory holding the bundled template documents.

    Resolves both when running from source and inside the PyInstaller one-file
    exe, where data files are unpacked to sys._MEIPASS at runtime.
    """
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "assets")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def _load_template(key: str) -> bytes:
    """Reads a bundled template's bytes, or raises a clear HTTP error."""
    fname = _TEMPLATES.get(key)
    if not fname:
        raise HTTPException(status_code=400, detail=f"Unknown experiment template '{key}'.")
    path = os.path.join(_assets_dir(), fname)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="The bundled experiment document is missing from this build of the backend.",
        )


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
    cols = ["Reading No.", "Distance (m)", "RSSI (dBm)", "Signal (%)", "Quality"]
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


# Blank paragraphs between the readings table and the graph. The syllabus
# document keeps the graph lower on the page (where the "Paste the Graph"
# placeholder used to sit), so we reproduce that spacing.
_GRAPH_GAP = 11

# Placeholder in the template that told students to paste their graph by hand.
# The export inserts the real graph, so this line (and the blank lines around it)
# are removed.
_GRAPH_PLACEHOLDER = "paste the graph"


def _p_is_empty(el) -> bool:
    return el.tag.endswith("}p") and not "".join(el.itertext()).strip()


def _remove_graph_placeholder(doc: Document) -> None:
    """
    Deletes the 'Paste the Graph' placeholder paragraph and one blank paragraph
    on each side of it, so the auto-inserted graph replaces it cleanly.
    """
    for para in list(doc.paragraphs):
        if para.text.strip().lower() != _GRAPH_PLACEHOLDER:
            continue
        el = para._element
        prev, nxt = el.getprevious(), el.getnext()
        if prev is not None and _p_is_empty(prev):
            prev.getparent().remove(prev)
        if nxt is not None and _p_is_empty(nxt):
            nxt.getparent().remove(nxt)
        el.getparent().remove(el)
        return


@router.post("/export")
async def export_to_document(
    readings: str = Form(...),
    document: Optional[UploadFile] = File(None),
    chart: Optional[UploadFile] = File(None),
    heading: str = Form("Result & Graph"),
    experiment: str = Form("Experiment 4 - Wi-Fi Signal Strength vs Distance"),
    template: str = Form("exp4"),
):
    """
    Inserts a "Result & Graph" section below the Observation Table of the
    experiment document and returns it. By default the bundled template for the
    given experiment is used (no upload); an uploaded .docx overrides it.
    """
    try:
        rows = json.loads(readings)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Readings payload was not valid JSON.")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="No readings to export.")

    # Source bytes + the base filename for the download. Prefer an uploaded file
    # (back-compat); otherwise fall back to the bundled template.
    if document is not None and document.filename:
        if not document.filename.lower().endswith(".docx"):
            raise HTTPException(status_code=400, detail="Please upload a .docx file (not .doc or .pdf).")
        raw = await document.read()
        base = document.filename[:-5]
    else:
        raw = _load_template(template)
        base = _TEMPLATES[template][:-5]  # e.g. "Expt. No. 4"

    try:
        doc = Document(io.BytesIO(raw))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not open the experiment document. Make sure it is a valid .docx.",
        )

    anchor_table = _find_observation_table(doc)
    if anchor_table is None:
        raise HTTPException(
            status_code=422,
            detail="No Observation Table found in the document, so there is nowhere to insert the results.",
        )

    # --- Build the new content at the end of the body, then relocate it ---
    built = []

    built.append(doc.add_paragraph())  # blank line before the heading

    h = doc.add_paragraph()
    hr = h.add_run(heading)
    hr.bold = True
    hr.font.size = Pt(14)
    hr.font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
    built.append(h)

    built.append(doc.add_paragraph())  # blank line after the heading

    try:
        style_hint = anchor_table.style
    except Exception:
        style_hint = None
    tbl = _build_readings_table(doc, rows, style_hint=style_hint)
    built.append(tbl)

    # Space between the readings table and the graph (matches the syllabus doc).
    for _ in range(_GRAPH_GAP):
        built.append(doc.add_paragraph())

    if chart is not None:
        img_bytes = await chart.read()
        if img_bytes:
            cap = doc.add_paragraph()
            cr = cap.add_run("Graph: Signal Strength vs Distance")
            cr.bold = True
            cr.font.size = Pt(10)
            built.append(cap)

            built.append(doc.add_paragraph())  # blank line before the image

            pic_para = doc.add_paragraph()
            pic_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            try:
                pic_para.add_run().add_picture(io.BytesIO(img_bytes), width=Inches(6.4))
            except Exception:
                # A bad/empty image must not lose the table the student just measured.
                pic_para.add_run("[Chart image could not be embedded]").italic = True
            built.append(pic_para)

            built.append(doc.add_paragraph())  # blank line after the image

    obs = doc.add_paragraph()
    obs.add_run("Observation: ").bold = True
    obs.add_run(_summary_sentence(rows))
    built.append(obs)

    built.append(doc.add_paragraph())  # trailing blank line before Conclusion

    # --- Move the built blocks to sit directly beneath the Observation Table ---
    anchor = anchor_table._element
    for block in built:
        el = block._element
        anchor.addnext(el)
        anchor = el

    # The graph now lives in the document, so drop the "Paste the Graph"
    # placeholder that the template used for a hand-pasted image.
    _remove_graph_placeholder(doc)

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)

    filename = f"{base} - with Results.docx"

    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
