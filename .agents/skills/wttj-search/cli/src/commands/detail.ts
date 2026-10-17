import { SITE, fetchRetry, normalizeId, parseJobPosting, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}" (expected <company>/<job> or a welcometothejungle.com job URL)`, "BAD_ID")
    return 1
  }
  const [company, job] = id.split("/")
  const url = `${SITE}/fr/companies/${company}/jobs/${job}`
  try {
    const res = await fetchRetry(url, { headers: { Accept: "text/html" } })
    if (!res) {
      writeError("Job not found (404) - the posting was probably taken down", "NOT_FOUND")
      return 1
    }
    const posting = parseJobPosting(await res.text())
    if (!posting) {
      writeError("No JobPosting data on the page - the posting is closed or the markup changed", "NOT_FOUND")
      return 1
    }
    const job_ = { id, url, ...posting }
    if (opts.format === "plain") {
      const lines = [
        job_.title ?? "(sans titre)",
        `${job_.company || "—"} · ${job_.location || "—"}`,
        job_.employmentType ? `Contrat : ${job_.employmentType}` : "",
        `Publiée : ${job_.datePosted || "—"} · Valable jusqu'au : ${job_.validThrough || "—"}`,
        "",
        job_.description || "(pas de description)",
        "",
        `URL : ${url}`,
      ].filter((l, i) => l !== "" || i > 3)
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job_, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
