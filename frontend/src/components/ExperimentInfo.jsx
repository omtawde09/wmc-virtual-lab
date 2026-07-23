import { useEffect } from 'react'
import { Link } from 'react-router-dom'

/**
 * Adds crawlable, human-useful content to the bottom of an experiment page:
 *   • an "About / theory" block (real indexable text — the UI alone has almost none)
 *   • an optional FAQ (rendered + emitted as FAQPage structured data)
 *   • internal links to related experiments (site-wide link equity)
 */
export default function ExperimentInfo({ heading, children, faqs = [], related = [] }) {
  // Emit FAQPage schema for the questions on this page.
  useEffect(() => {
    document.head.querySelectorAll('script[data-seo="faq"]').forEach(n => n.remove())
    if (!faqs.length) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo', 'faq')
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
  }, [faqs])

  return (
    <>
      <section className="glass-card content-block" style={{ marginTop: '24px' }}>
        <h2 className="content-h2">{heading}</h2>
        <div className="prose">{children}</div>

        {faqs.length > 0 && (
          <>
            <h3 className="content-h3">Frequently asked questions</h3>
            <div className="faq-list">
              {faqs.map((f, i) => (
                <details className="faq-item" key={i}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </>
        )}
      </section>

      {related.length > 0 && (
        <section className="glass-card content-block" style={{ marginTop: '24px' }}>
          <h2 className="content-h2">Related experiments</h2>
          <div className="related-grid">
            {related.map(r => (
              <Link to={r.to} className="related-card" key={r.to}>
                <strong>{r.title}</strong>
                <span>{r.blurb}</span>
                <em>Open experiment →</em>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
