// Data source: Welcome to the Jungle (France).
// Search: the public, search-only Algolia key the welcometothejungle.com front end
// ships to every browser (the index only answers requests that carry the site's
// Referer). Detail: the public job page, parsed from its schema.org JobPosting
// JSON-LD block (robots.txt allows /fr/companies/*/jobs/*).

export const ALGOLIA_APP = "CSEKHVMS53"
export const ALGOLIA_KEY = "4bd8f6215d0cc52b26430765769e65a0"
export const ALGOLIA_INDEX = "wttj_jobs_production_fr"
export const ALGOLIA_URL = `https://${ALGOLIA_APP.toLowerCase()}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
export const SITE = "https://www.welcometothejungle.com"

const UA = "Mozilla/5.0 (compatible; wttj-search-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** fetch with exponential backoff + jitter on 429/5xx. Returns null on a 404. */
export async function fetchRetry(url: string, init: RequestInit = {}): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Referer: `${SITE}/`, ...(init.headers ?? {}) },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 500)))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    return response
  }
  throw new Error("Request failed after max retries")
}

export const CONTRACTS = [
  "apprenticeship",
  "internship",
  "full_time",
  "temporary",
  "freelance",
  "part_time",
  "graduate_program",
  "vie",
] as const

export interface JobResult {
  id: string // "<company-slug>/<job-slug>"
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  contract: string | null
  remote: string | null
  summary: string | null
}

// Algolia hit shape (only the fields we read).
export interface Hit {
  name?: string
  slug?: string
  organization?: { name?: string; slug?: string }
  offices?: { city?: string; district?: string; state?: string; country_code?: string }[]
  published_at_date?: string
  contract_type?: string
  remote?: string
  summary?: string
}

export function hitToResult(h: Hit): JobResult | null {
  const org = h.organization?.slug
  if (!h.slug || !org || !h.name) return null
  const o = h.offices?.[0]
  const location = o ? [o.city, o.state].filter(Boolean).join(", ") || null : null
  return {
    id: `${org}/${h.slug}`,
    title: h.name.trim(),
    company: h.organization?.name?.trim() || null,
    location,
    date: h.published_at_date ?? null,
    url: `${SITE}/fr/companies/${org}/jobs/${h.slug}`,
    contract: h.contract_type ?? null,
    remote: h.remote ?? null,
    summary: h.summary?.trim() || null,
  }
}

/** Build the Algolia `filters` string. Values are quoted so spaces/accents are safe. */
export function buildFilters(opts: { region?: string; contract?: string; sinceTs?: number }): string {
  const parts = ['offices.country_code:"FR"']
  if (opts.region) parts.push(`offices.state:"${opts.region.replace(/"/g, "")}"`)
  if (opts.contract) parts.push(`contract_type:"${opts.contract}"`)
  if (opts.sinceTs !== undefined) parts.push(`published_at_timestamp >= ${opts.sinceTs}`)
  return parts.join(" AND ")
}

/** Accept "<company>/<job>" or any welcometothejungle.com job URL. */
export function normalizeId(input: string): string | null {
  const t = input.trim()
  if (/^[a-z0-9-]+\/[a-z0-9_.-]+$/i.test(t)) return t
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (!/(^|\.)welcometothejungle\.com$/i.test(u.hostname)) return null
  const m = u.pathname.match(/\/companies\/([^/]+)\/jobs\/([^/?#]+)/)
  return m ? `${m[1]}/${m[2]}` : null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => numericEntity(parseInt(d, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => numericEntity(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
}

/** HTML fragment -> readable text, keeping paragraph and list breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export interface JobPosting {
  title: string | null
  company: string | null
  location: string | null
  datePosted: string | null
  validThrough: string | null
  employmentType: string | null
  description: string | null
}

/** Find the schema.org JobPosting JSON-LD block in a page and normalize it. */
export function parseJobPosting(html: string): JobPosting | null {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const items = Array.isArray(data) ? data : [data]
    for (const d of items as Record<string, any>[]) {
      if (d?.["@type"] !== "JobPosting") continue
      const locs = Array.isArray(d.jobLocation) ? d.jobLocation : d.jobLocation ? [d.jobLocation] : []
      const location =
        locs
          .map((l: any) => [l?.address?.addressLocality, l?.address?.postalCode].filter(Boolean).join(" "))
          .filter(Boolean)
          .join(" / ") || null
      const emp = Array.isArray(d.employmentType) ? d.employmentType.join(", ") : d.employmentType
      return {
        title: d.title ? decodeEntities(String(d.title)).trim() : null,
        company: d.hiringOrganization?.name ? decodeEntities(String(d.hiringOrganization.name)) : null,
        location,
        datePosted: d.datePosted ? String(d.datePosted).slice(0, 10) : null,
        validThrough: d.validThrough ? String(d.validThrough).slice(0, 10) : null,
        employmentType: emp ? String(emp) : null,
        description: d.description ? htmlToText(String(d.description)) : null,
      }
    }
  }
  return null
}
