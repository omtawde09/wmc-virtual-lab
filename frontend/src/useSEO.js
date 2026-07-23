import { useEffect } from 'react'

/**
 * Per-route SEO without pulling in react-helmet.
 * Updates <title>, meta description, canonical, Open Graph / Twitter tags and
 * injects a per-page JSON-LD block. Everything it adds is tagged data-seo so it
 * can be cleanly replaced on the next route.
 */

export const SITE_URL = 'https://wmc-virtual-lab.vercel.app'
export const SITE_NAME = 'Wireless & Mobile Communication Virtual Lab'

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * @param {object} o
 * @param {string} o.title        Full <title> for the route
 * @param {string} o.description  Meta description (aim 140–160 chars)
 * @param {string} o.path         Route path, e.g. '/practical4'
 * @param {string} [o.keywords]   Comma-separated (minor signal, harmless)
 * @param {object|object[]} [o.jsonLd] Extra structured data for this route
 */
export function useSEO({ title, description, path = '/', keywords, jsonLd }) {
  useEffect(() => {
    const url = `${SITE_URL}${path === '/' ? '/' : path}`

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'keywords', keywords)
    upsertCanonical(url)

    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', path === '/' ? 'website' : 'article')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)

    // Per-route structured data (replaced on every route change)
    document.head.querySelectorAll('script[data-seo="route"]').forEach(n => n.remove())
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo', 'route')
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [title, description, path, keywords, jsonLd])
}

/** Breadcrumb + LearningResource graph for an experiment page. */
export function experimentSchema({ name, description, path, teaches }) {
  const url = `${SITE_URL}${path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        '@id': `${url}#resource`,
        name,
        description,
        url,
        learningResourceType: 'Experiment',
        educationalLevel: 'Undergraduate',
        teaches,
        inLanguage: 'en',
        isAccessibleForFree: true,
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME },
        provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name, item: url },
        ],
      },
    ],
  }
}
