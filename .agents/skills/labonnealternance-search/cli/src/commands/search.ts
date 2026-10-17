import {
  OFFER_LABELS,
  SEARCH_URL,
  SPONTANEOUS_LABEL,
  fetchRetry,
  geocode,
  hitToResult,
  writeError,
  type Hit,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  radius: number
  jobage?: number
  spontanees: boolean
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PER_PAGE = 50

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "Aucun résultat."
  const header = "DATE".padEnd(11) + "TITRE".padEnd(50) + "ENTREPRISE".padEnd(28) + "LIEU"
  const lines = rows.map(
    (r) =>
      (r.date || "—").padEnd(11) +
      r.title.slice(0, 48).padEnd(50) +
      (r.company || "—").slice(0, 26).padEnd(28) +
      (r.location || "—"),
  )
  return [header, "-".repeat(header.length + 20), ...lines].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const params = new URLSearchParams({
      mode: "emplois",
      hitsPerPage: String(PER_PAGE),
      page: String(opts.page - 1),
    })
    if (opts.query) params.set("q", opts.query)
    let place: string | null = null
    if (opts.location) {
      const geo = await geocode(opts.location)
      if (!geo) {
        writeError(`Could not geocode --location "${opts.location}" (try a city or postcode)`, "BAD_LOCATION")
        return 1
      }
      place = geo.label
      params.set("latitude", String(geo.lat))
      params.set("longitude", String(geo.lon))
      params.set("radius", String(opts.radius))
    }
    for (const label of OFFER_LABELS) params.append("type_filter_label", label)
    if (opts.spontanees) params.append("type_filter_label", SPONTANEOUS_LABEL)

    const res = await fetchRetry(`${SEARCH_URL}?${params}`)
    if (!res) throw new Error("Search endpoint not found (404) - the site's API path changed; see url-reference.md")
    const data = (await res.json()) as { hits?: Hit[]; nbHits?: number }
    let rows = (data.hits ?? []).map(hitToResult).filter((r): r is JobResult => r !== null)
    if (opts.jobage !== undefined) {
      const cutoff = new Date(Date.now() - opts.jobage * 86400000).toISOString().slice(0, 10)
      // Undated rows are kept: dropping them would hide offers the API did not date.
      rows = rows.filter((r) => r.date === null || r.date >= cutoff)
    }
    rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        rows
          .map((r) => `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"} · ${r.level || "niveau ?"}\n  ${r.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: rows.length, page: opts.page, total: data.nbHits ?? null, place }, results: rows }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
