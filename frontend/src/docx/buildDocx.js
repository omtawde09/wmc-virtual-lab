/**
 * Client-side experiment-document export.
 *
 * A .docx is a ZIP of XML parts, so the whole job can be done in the browser:
 * read the bundled syllabus template, splice a "Result" section into
 * word/document.xml right after the Observation Table, embed the chart PNG as a
 * proper image part, and re-zip. This mirrors backend/doc_export.py exactly, so
 * Android produces the same document the Windows backend does — the template is
 * preserved rather than a new file being generated from scratch.
 *
 * Pure functions over bytes: no DOM, no network. That keeps it testable in Node.
 */
import JSZip from 'jszip'

const XML_NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

/** Escape text for inclusion in XML character data / attributes. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A run of text with optional bold / size (half-points) / colour. */
function run(text, { bold = false, size = null, color = null, italic = false } = {}) {
  const props = [
    bold ? '<w:b/>' : '',
    italic ? '<w:i/>' : '',
    size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : '',
    color ? `<w:color w:val="${color}"/>` : '',
  ].join('')
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}` +
         `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

/** A paragraph made of pre-built runs. */
function para(runsXml = '') {
  return `<w:p>${runsXml}</w:p>`
}

/** Grey single-line borders on every edge, matching the Python export. */
const TABLE_BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(e => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('') +
  '</w:tblBorders>'

/**
 * Build a table. `headers` is an array of strings; `rows` an array of arrays.
 * Header cells are bold 9pt, body cells 9pt — same as the backend output.
 */
function table(headers, rows) {
  // Usable width of a portrait A4/Letter page with 1" margins, in twips.
  const USABLE_TWIPS = 9360
  const colW = Math.floor(USABLE_TWIPS / headers.length)

  const cell = (text, bold) =>
    `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr>` +
    `${para(run(text, { bold, size: 18 }))}</w:tc>`

  // <w:tblGrid> is REQUIRED by the OOXML schema — without it Word treats the
  // table as malformed (and python-docx refuses to read it).
  const grid = `<w:tblGrid>${headers.map(() => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>`

  const headerRow = `<w:tr>${headers.map(h => cell(h, true)).join('')}</w:tr>`
  const bodyRows = rows
    .map(cells => `<w:tr>${cells.map(c => cell(c, false)).join('')}</w:tr>`)
    .join('')

  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
         `${TABLE_BORDERS}</w:tblPr>${grid}${headerRow}${bodyRows}</w:tbl>`
}

/** EMU per inch — OOXML measures drawings in English Metric Units. */
const EMU_PER_INCH = 914400

/** An inline image run referencing an already-added relationship id. */
function imageRun(relId, widthInches, aspect, name = 'chart') {
  const cx = Math.round(widthInches * EMU_PER_INCH)
  const cy = Math.round(cx * aspect)
  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="${esc(name)}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="1" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
    `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  )
}

/** Read PNG width/height from the IHDR chunk (bytes 16..24). */
function pngSize(bytes) {
  const dv = new DataView(bytes.buffer ?? bytes, bytes.byteOffset ?? 0)
  return { width: dv.getUint32(16), height: dv.getUint32(24) }
}

/**
 * Find the end index of the Observation Table in document.xml.
 *
 * Matches on header text rather than position (same rationale as the Python
 * version: student copies vary), then walks to that table's closing tag.
 */
function findAnchorTableEnd(xml, markers, { last = false } = {}) {
  const tables = []
  const re = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    tables.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  if (!tables.length) return -1

  const plain = (t) => t.replace(/<[^>]+>/g, ' ').toLowerCase()
  const scored = tables.filter(t => {
    const p = plain(t.text)
    return markers.filter(k => p.includes(k)).length >= 2
  })
  if (scored.length) return (last ? scored[scored.length - 1] : scored[0]).end
  // Fall back to the first/last table so the result still lands in the right area.
  return (last ? tables[tables.length - 1] : tables[0]).end
}

/**
 * Splice `insertXml` into document.xml immediately after the anchor table, add
 * `image` (if any) as a real image part, and return the new .docx bytes.
 */
async function spliceIntoTemplate(templateBytes, { markers, anchorLast, buildXml, image }) {
  const zip = await JSZip.loadAsync(templateBytes)
  const docPath = 'word/document.xml'
  let xml = await zip.file(docPath).async('string')

  let imageRelId = null
  if (image?.bytes?.length) {
    // Register the PNG as a new part + relationship.
    const relsPath = 'word/_rels/document.xml.rels'
    let rels = await zip.file(relsPath).async('string')
    const used = [...rels.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]))
    const next = (used.length ? Math.max(...used) : 0) + 1
    imageRelId = `rId${next}`

    const mediaName = `wmc_chart_${next}.png`
    zip.file(`word/media/${mediaName}`, image.bytes)
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${imageRelId}" ` +
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
      `Target="media/${mediaName}"/></Relationships>`,
    )
    zip.file(relsPath, rels)

    // PNG must be declared in [Content_Types].xml or Word refuses the file.
    const ctPath = '[Content_Types].xml'
    let ct = await zip.file(ctPath).async('string')
    if (!/Extension="png"/i.test(ct)) {
      ct = ct.replace('</Types>',
        '<Default Extension="png" ContentType="image/png"/></Types>')
      zip.file(ctPath, ct)
    }
  }

  const at = findAnchorTableEnd(xml, markers, { last: anchorLast })
  if (at < 0) throw new Error('No observation table found in the document.')

  const insertXml = buildXml({ imageRelId, image })
  xml = xml.slice(0, at) + insertXml + xml.slice(at)
  zip.file(docPath, xml)

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

const HEADING_SIZE = 28   // half-points → 14pt
const LABEL_SIZE = 22     // 11pt
const NOTE_SIZE = 18      // 9pt
const INK = '1F2A44'

const num = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return v == null ? '' : String(v)
  return Number.isInteger(n) ? String(n) : String(n)
}

function quality(rssi) {
  const v = Number(rssi)
  if (!Number.isFinite(v)) return ''
  if (v >= -50) return 'Excellent'
  if (v >= -60) return 'Good'
  if (v >= -70) return 'Fair'
  return 'Poor'
}

/** Experiment 4 — readings table + graph, inserted below the Observation Table. */
export async function buildExp4Docx(templateBytes, { readings, chart }) {
  if (!readings?.length) throw new Error('No readings to export.')

  return spliceIntoTemplate(templateBytes, {
    markers: ['reading no', 'distance', 'signal strength'],
    anchorLast: false,
    image: chart,
    buildXml: ({ imageRelId, image }) => {
      const rows = readings.map((r, i) => [
        String(i + 1), num(r.distance), num(r.rssi), num(r.signal_pct),
        r.quality || quality(r.rssi),
      ])
      const parts = [
        para(),
        para(run('Result & Graph', { bold: true, size: HEADING_SIZE, color: INK })),
        para(),
        table(['Reading No.', 'Distance (m)', 'RSSI (dBm)', 'Signal (%)', 'Quality'], rows),
      ]
      // Matches the syllabus layout, which keeps the graph lower on the page.
      for (let i = 0; i < 11; i++) parts.push(para())

      if (imageRelId && image) {
        const { width, height } = pngSize(image.bytes)
        parts.push(para(run('Graph: Signal Strength vs Distance', { bold: true, size: 20 })))
        parts.push(para())
        parts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imageRun(imageRelId, 6.4, height / width)}</w:p>`)
        parts.push(para())
      }

      const vals = readings.map(r => Number(r.rssi)).filter(Number.isFinite)
      const dists = readings.map(r => Number(r.distance)).filter(Number.isFinite)
      const summary = (vals.length && dists.length)
        ? `Across ${readings.length} readings taken between ${Math.min(...dists)} m and ` +
          `${Math.max(...dists)} m, the measured RSSI ranged from ${Math.max(...vals)} dBm ` +
          `(strongest) to ${Math.min(...vals)} dBm (weakest), a total variation of ` +
          `${Math.abs(Math.max(...vals) - Math.min(...vals))} dB. This confirms the inverse, ` +
          'non-linear relationship between received signal strength and distance described by ' +
          'the log-distance path loss model.'
        : 'Measured Wi-Fi signal strength at multiple distances from the access point.'
      parts.push(para(run('Observation: ', { bold: true }) + run(summary)))
      parts.push(para())
      return parts.join('')
    },
  })
}

/** Experiment 5 — CLI ping (Table 1) and/or speed test (Table 2) results. */
export async function buildExp5Docx(templateBytes, { ping, speedtest, chart, platform }) {
  if (!ping && !speedtest) throw new Error('No measured results to export.')

  return spliceIntoTemplate(templateBytes, {
    markers: ['platform', 'download throughput', 'upload throughput'],
    anchorLast: true,   // sits below Table 2, before the Conclusion
    image: chart,
    buildXml: ({ imageRelId, image }) => {
      const parts = [
        para(),
        para(run('Result', { bold: true, size: HEADING_SIZE, color: INK })),
        para(),
      ]

      if (ping) {
        parts.push(para(run('Table 1: Command Line Interface (CLI) Results — Measured',
          { bold: true, size: LABEL_SIZE })))
        parts.push(table(
          ['Target Host', 'Packets Sent', 'Packets Received', 'Packet Loss (%)',
            'Minimum Latency (ms)', 'Maximum Latency (ms)', 'Average Latency (ms)'],
          [[ping.host ?? '', num(ping.sent), num(ping.received), num(ping.packet_loss),
            num(ping.min_rtt), num(ping.max_rtt), num(ping.avg_rtt)]],
        ))
        if (ping.jitter != null) {
          parts.push(para(run(`Jitter (avg RTT variation): ${num(ping.jitter)} ms`,
            { size: NOTE_SIZE, italic: true })))
        }
        parts.push(para())
      }

      if (speedtest) {
        parts.push(para(run('Table 2: Online Simulation Results — Measured',
          { bold: true, size: LABEL_SIZE })))
        parts.push(table(
          ['Platform', 'Download Throughput (Mbps)', 'Upload Throughput (Mbps)', 'Latency / Ping (ms)'],
          [[platform || 'Mobile (Android)', num(speedtest.download_mbps),
            num(speedtest.upload_mbps), num(speedtest.ping_ms)]],
        ))
        const srv = (speedtest.server_name || '').trim()
        if (srv) {
          const loc = speedtest.server_country ? `, ${speedtest.server_country}` : ''
          parts.push(para(run(`Test server: ${srv}${loc}`, { size: NOTE_SIZE, italic: true })))
        }
        parts.push(para())
      }

      if (imageRelId && image) {
        const { width, height } = pngSize(image.bytes)
        parts.push(para(run('Graph: Throughput over time', { bold: true, size: 20 })))
        parts.push(para())
        parts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imageRun(imageRelId, 6.0, height / width)}</w:p>`)
        parts.push(para())
      }

      const bits = []
      if (speedtest) {
        bits.push(`The live speed test measured ${num(speedtest.download_mbps)} Mbps download and ` +
          `${num(speedtest.upload_mbps)} Mbps upload throughput at a ping of ` +
          `${num(speedtest.ping_ms)} ms (jitter ${num(speedtest.jitter_ms)} ms).`)
      }
      if (ping) {
        bits.push(`The command-line ping to ${ping.host || 'the target host'} sent ${num(ping.sent)} ` +
          `packets with ${num(ping.packet_loss)}% loss and an average round-trip time of ` +
          `${num(ping.avg_rtt)} ms (min ${num(ping.min_rtt)} ms, max ${num(ping.max_rtt)} ms).`)
      }
      const summary = bits.length
        ? bits.join(' ') + ' Together these confirm that throughput and latency are independent ' +
          'pillars of network quality.'
        : "Measured the network's throughput and latency using real tools."
      parts.push(para(run('Observation: ', { bold: true }) + run(summary)))
      parts.push(para())
      return parts.join('')
    },
  })
}

export const __test__ = { findAnchorTableEnd, pngSize }
