import axios from 'axios'

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
 * Uploads the student's experiment .docx along with their readings and chart;
 * the backend inserts a "Result & Graph" section under the Observation Table and
 * returns the modified document, which we then download.
 */
export async function exportToExperimentDoc({ file, readings, chartBlob, experiment }) {
  const form = new FormData()
  form.append('document', file)
  form.append('readings', JSON.stringify(readings))
  if (chartBlob) form.append('chart', chartBlob, 'chart.png')
  if (experiment) form.append('experiment', experiment)

  try {
    const res = await axios.post('/api/docx/export', form, {
      responseType: 'blob',
      timeout: 60000,
    })

    // Prefer the filename the server chose.
    const disp = res.headers['content-disposition'] || ''
    const match = /filename="?([^"]+)"?/.exec(disp)
    const name = match ? match[1] : file.name.replace(/\.docx$/i, '') + ' - with Results.docx'

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
