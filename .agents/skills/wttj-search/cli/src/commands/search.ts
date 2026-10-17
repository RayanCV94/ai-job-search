import {
  ALGOLIA_APP,
  ALGOLIA_KEY,
  ALGOLIA_URL,
  buildFilters,
  fetchRetry,
  hitToResult,
  writeError,
  type Hit,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  region?: string
  contract?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PER_PAGE = 30

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "Aucun résultat."
  const header = "DATE".padEnd(11) + "TITRE".padEnd(48) + "ENTREPRISE".padEnd(26) + "LIEU"
  const lines = rows.map(
    (r) =>
      (r.date || "—").padEnd(11) +
      r.title.slice(0, 46).padEnd(48) +
      (r.company || "—").slice(0, 24).padEnd(26) +
      (r.location || "—"),
  )
  return [header, "-".repeat(header.length + 20), ...lines].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const sinceTs =
      opts.jobage !== undefined ? Math.floor(Date.now() / 1000) - opts.jobage * 86400 : undefined
    const body = {
      query: opts.query ?? "",
      hitsPerPage: PER_PAGE,
      page: opts.page - 1,
      filters: buildFilters({ region: opts.region, contract: opts.contract, sinceTs }),
      attributesToRetrieve: [
        "name", "slug", "organization.name", "organization.slug", "offices",
        "published_at_date", "contract_type", "remote", "summary",
      ],
      attributesToHighlight: [],
    }
    const res = await fetchRetry(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "X-Algolia-Application-Id": ALGOLIA_APP,
        "X-Algolia-API-Key": ALGOLIA_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res) throw new Error("Algolia index not found (404) - the public key or index name changed")
    const data = (await res.json()) as { hits?: Hit[]; nbHits?: number }
    let rows = (data.hits ?? []).map(hitToResult).filter((r): r is JobResult => r !== null)
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        rows
          .map((r) => `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"} · ${r.contract || "—"}\n  ${r.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: rows.length, page: opts.page, total: data.nbHits ?? null }, results: rows }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
