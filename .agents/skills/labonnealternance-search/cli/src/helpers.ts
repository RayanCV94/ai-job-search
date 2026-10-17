// Data source: La bonne alternance (French State apprenticeship portal, beta.gouv.fr).
// Search: the JSON endpoint the site's own search page calls (/api/v1/search).
// Detail: the public job page, parsed from its schema.org JobPosting JSON-LD block.
// Geocoding of --location: the national address API (api-adresse.data.gouv.fr).
// All three are public and need no key; robots.txt allows /api/ and /emploi/.

export const SITE = "https://labonnealternance.apprentissage.beta.gouv.fr"
export const SEARCH_URL = `${SITE}/api/v1/search`
export const GEOCODE_URL = "https://api-adresse.data.gouv.fr/search/"

const UA = "Mozilla/5.0 (compatible; labonnealternance-search-cli/1.0)"

// type_filter_label values for real job offers. The third value the API knows,
// "Candidatures spontanées", is a list of companies likely to hire an apprentice,
// not a posted offer - only included with --spontanees.
export const OFFER_LABELS = ["Offres d'emploi partenaires", "Offres d'emploi La bonne alternance"]
export const SPONTANEOUS_LABEL = "Candidatures spontanées"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** fetch with exponential backoff + jitter on 429/5xx. Returns null on a 404. */
export async function fetchRetry(url: string, accept = "application/json"): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 500)))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Request failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`)
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

/** City / postcode / address -> [lat, lon] via the national address API. */
export async function geocode(place: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const res = await fetchRetry(`${GEOCODE_URL}?${new URLSearchParams({ q: place, limit: "1" })}`)
  if (!res) return null
  const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: { label: string; context?: string } }[] }
  const f = data.features?.[0]
  if (!f) return null
  const [lon, lat] = f.geometry.coordinates
  return { lat, lon, label: [f.properties.label, f.properties.context].filter(Boolean).join(" - ") }
}

export interface Hit {
  url_id?: string
  sub_type?: string
  title?: string
  organization_name?: string
  address?: string
  publication_date?: string | null
  contract_type?: string[]
  level?: string | null
  distance?: number
}

export interface JobResult {
  id: string // "<sub_type>/<url_id>"
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  kind: "offre" | "candidature_spontanee"
  contract: string | null
  level: string | null
  distanceKm: number | null
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "offre"
}

export function hitToResult(h: Hit): JobResult | null {
  if (!h.url_id || !h.sub_type || !h.title) return null
  const title = decodeEntities(h.title).trim()
  return {
    id: `${h.sub_type}/${h.url_id}`,
    title,
    company: h.organization_name ? decodeEntities(h.organization_name).trim() || null : null,
    location: h.address?.trim() || null,
    date: h.publication_date ? h.publication_date.slice(0, 10) : null,
    url: `${SITE}/emploi/${h.sub_type}/${h.url_id}/${slugify(title)}`,
    kind: h.sub_type === "recruteurs_lba" ? "candidature_spontanee" : "offre",
    contract: h.contract_type?.length ? h.contract_type.join(", ") : null,
    level: h.level ?? null,
    distanceKm: typeof h.distance === "number" ? Math.round(h.distance * 10) / 10 : null,
  }
}

/** Accept "<sub_type>/<id>" or a labonnealternance job URL. Returns "<sub_type>/<id>". */
export function normalizeId(input: string): string | null {
  const t = input.trim()
  if (/^[a-z_]+\/[a-z0-9]+$/i.test(t)) return t
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (!/^labonnealternance\.apprentissage\.beta\.gouv\.fr$/i.test(u.hostname)) return null
  const m = u.pathname.match(/^\/emploi\/([a-z_]+)\/([a-z0-9]+)/i)
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
