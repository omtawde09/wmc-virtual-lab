import axios from 'axios'
import { IS_ANDROID } from './config'

/** Minimum readings before the export option is offered. */
export const MIN_READINGS_FOR_EXPORT = 5

/**
 * Picks the real chart <svg> inside a container.
 *
 * Recharts renders every legend entry as its own tiny 14x14 `recharts-surface`
 * SVG, so a naive querySelector('svg') returns a legend icon and you end up
 * exporting a 14px blank image. Choosing the largest SVG by area is robust
 * regardless of how many legend items the chart has.
 */
export function findChartSvg(container) {
  if (!container) return null
  const svgs = [...container.querySelectorAll('svg')]
  if (!svgs.length) return null
  return svgs.reduce((best, el) => {
    const r = el.getBoundingClientRect()
    const b = best?.getBoundingClientRect()
    return !b || r.width * r.height > b.width * b.height ? el : best
  }, null)
}

/**
 * Rasterises a live Recharts <svg> to a PNG Blob.
 *
 * Done in the browser rather than re-plotting server-side on purpose: it exports
 * exactly the chart the student is looking at, and avoids adding a heavy
 * plotting library (matplotlib) to the backend .exe, which would roughly double
 * its download size.
 */
export async function chartSvgToPngBlob(svgEl, { background = '#ffffff', scale = 2 } = {}) {
  if (!svgEl) return null

  const rect = svgEl.getBoundingClientRect()
  const width = Math.round(svgEl.viewBox?.baseVal?.width || rect.width || 900)
  const height = Math.round(svgEl.viewBox?.baseVal?.height || rect.height || 420)

  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  // Inline the font so text doesn't fall back to a serif default once detached
  // from the page's stylesheet.
  clone.setAttribute('style', "font-family: Inter, system-ui, -apple-system, sans-serif")

  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not rasterise the chart'))
      i.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = background                       // Word has no page transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise(res => canvas.toBlob(res, 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Triggers a browser download of a blob response, using the server's filename. */
function downloadBlobResponse(res, fallbackName) {
  const disp = res.headers['content-disposition'] || ''
  const match = /filename="?([^"]+)"?/.exec(disp)
  const name = match ? match[1] : fallbackName

  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

/**
 * Experiment 5 export. Sends the student's real command-line ping and/or live
 * speed-test results (plus an optional throughput chart) to the backend, which
 * inserts a measured "Result" section below the throughput observation table of
 * the bundled Exp-5 document and returns the finished file to download.
 */
export async function exportExp5Doc({ ping, speedtest, chartBlob, template = 'exp5' }) {
  if (IS_ANDROID) return exportExp5Native({ ping, speedtest, chartBlob })

  const form = new FormData()
  if (ping) form.append('ping', JSON.stringify(ping))
  if (speedtest) form.append('speedtest', JSON.stringify(speedtest))
  form.append('template', template)
  if (chartBlob) form.append('chart', chartBlob, 'chart.png')

  try {
    const res = await axios.post('/api/docx/export/network', form, {
      responseType: 'blob',
      timeout: 60000,
    })
    const name = downloadBlobResponse(res, 'Experiment 5 - with Results.docx')
    return { ok: true, name }
  } catch (err) {
    throw new Error(await blobErrorMessage(err, 'Export failed. Is the local backend running?'))
  }
}

/**
 * Experiment 6 export. Writes the discovered-device table (Table 1) and the
 * paced RSSI field-test table (Table 2) — plus the optional RSSI-vs-distance
 * graph — into the Exp-6 document below its range-test observation table.
 */
export async function exportExp6Doc({ devices, readings, chartBlob, template = 'exp6' }) {
  if (IS_ANDROID) return exportExp6Native({ devices, readings, chartBlob })

  const form = new FormData()
  if (devices?.length) form.append('devices', JSON.stringify(devices))
  if (readings?.length) form.append('readings', JSON.stringify(readings))
  form.append('template', template)
  if (chartBlob) form.append('chart', chartBlob, 'chart.png')

  try {
    const res = await axios.post('/api/docx/export/bluetooth', form, {
      responseType: 'blob',
      timeout: 60000,
    })
    const name = downloadBlobResponse(res, 'Experiment 6 - with Results.docx')
    return { ok: true, name }
  } catch (err) {
    throw new Error(await blobErrorMessage(err, 'Export failed. Is the local backend running?'))
  }
}

/* ── Android: build the document in the browser, save it via the native bridge ── */

/** Fetch the bundled syllabus template that ships with the web build. */
async function loadTemplate(name) {
  const res = await fetch(`/templates/${name}.docx`)
  if (!res.ok) throw new Error('Could not load the bundled experiment document.')
  return new Uint8Array(await res.arrayBuffer())
}

function bytesToBase64(bytes) {
  // Chunked so a multi-MB document doesn't blow the argument limit.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Hand the finished document to Android, which writes it to Downloads. */
async function saveNatively(bytes, fileName) {
  const { saveFile } = await import('./hardware')
    .then(m => m.default ?? m.Hardware)
  const res = await saveFile(fileName, bytesToBase64(bytes), DOCX_MIME)
  return { ok: true, name: fileName, path: res?.path || 'Downloads' }
}

/** Experiment 4 export, generated entirely on-device. */
async function exportExp4Native({ readings, chartBlob }) {
  const { buildExp4Docx } = await import('./docx/buildDocx')
  const template = await loadTemplate('exp4')
  const chart = chartBlob
    ? { bytes: new Uint8Array(await chartBlob.arrayBuffer()) }
    : null
  const out = await buildExp4Docx(template, { readings, chart })
  return saveNatively(out, 'Expt. No. 4 - with Results.docx')
}

/** Experiment 5 export, generated entirely on-device. */
async function exportExp5Native({ ping, speedtest, chartBlob }) {
  const { buildExp5Docx } = await import('./docx/buildDocx')
  const template = await loadTemplate('exp5')
  const chart = chartBlob
    ? { bytes: new Uint8Array(await chartBlob.arrayBuffer()) }
    : null
  const out = await buildExp5Docx(template, {
    ping, speedtest, chart, platform: 'Mobile (Android)',
  })
  return saveNatively(out, 'Expt No. 5 - with Results.docx')
}

/** Experiment 6 export, generated entirely on-device. */
async function exportExp6Native({ devices, readings, chartBlob }) {
  const { buildExp6Docx } = await import('./docx/buildDocx')
  const template = await loadTemplate('exp6')
  const chart = chartBlob
    ? { bytes: new Uint8Array(await chartBlob.arrayBuffer()) }
    : null
  const out = await buildExp6Docx(template, { devices, readings, chart })
  return saveNatively(out, 'Expt. No. 6 - with Results.docx')
}

/** Reads an error message out of a Blob response (errors arrive as blobs too). */
async function blobErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())
      if (parsed?.detail) return parsed.detail
    } catch { /* not JSON — fall through */ }
  }
  return err?.response?.data?.detail || err?.message || fallback
}

/**
 * Sends the student's readings and chart to the backend, which inserts a
 * "Result & Graph" section under the Observation Table of the bundled experiment
 * document and returns the finished file, which we then download. No upload is
 * needed — `template` selects which built-in document to use.
 */
export async function exportToExperimentDoc({ readings, chartBlob, experiment, template = 'exp4' }) {
  // Android has no backend: build the .docx in the WebView and save it natively.
  if (IS_ANDROID) return exportExp4Native({ readings, chartBlob })

  const form = new FormData()
  form.append('readings', JSON.stringify(readings))
  form.append('template', template)
  if (chartBlob) form.append('chart', chartBlob, 'chart.png')
  if (experiment) form.append('experiment', experiment)

  try {
    const res = await axios.post('/api/docx/export', form, {
      responseType: 'blob',
      timeout: 60000,
    })

    // Prefer the filename the server chose; fall back to a sensible default.
    const disp = res.headers['content-disposition'] || ''
    const match = /filename="?([^"]+)"?/.exec(disp)
    const name = match ? match[1] : 'Experiment - with Results.docx'

    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    return { ok: true, name }
  } catch (err) {
    throw new Error(await blobErrorMessage(err, 'Export failed. Is the local backend running?'))
  }
}
