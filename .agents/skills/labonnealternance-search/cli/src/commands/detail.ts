import { SITE, fetchRetry, normalizeId, parseJobPosting, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}" (expected <sub_type>/<id> or a labonnealternance job URL)`, "BAD_ID")
    return 1
  }
  // The trailing slug is cosmetic: the site resolves the page from sub_type + id.
  const url = `${SITE}/emploi/${id}/offre`
  try {
    const res = await fetchRetry(url, "text/html")
    if (!res) {
      writeError("Job not found (404) - the offer was probably taken down", "NOT_FOUND")
      return 1
    }
    const posting = parseJobPosting(await res.text())
    if (!posting) {
      const hint = id.startsWith("recruteurs_lba/")
        ? " (recruteurs_lba entries are companies open to spontaneous applications, not posted offers)"
        : ""
      writeError(`No JobPosting data on the page${hint}`, "NOT_FOUND")
      return 1
    }
    const job = { id, url, ...posting }
    if (opts.format === "plain") {
      const lines = [
        job.title ?? "(sans titre)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.employmentType ? `Contrat : ${job.employmentType}` : "",
        `Publiée : ${job.datePosted || "—"} · Valable jusqu'au : ${job.validThrough || "—"}`,
        "",
        job.description || "(pas de description)",
        "",
        `URL : ${url}`,
      ].filter((l, i) => l !== "" || i > 3)
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
