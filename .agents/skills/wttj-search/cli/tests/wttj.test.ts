import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers"
import { buildFilters, hitToResult, normalizeId, parseJobPosting } from "../src/helpers"

describe("parsing (offline)", () => {
  test("hitToResult maps an Algolia hit to the contract fields", () => {
    const r = hitToResult({
      name: " Data Scientist - Alternance ",
      slug: "data-scientist-alternance_paris",
      organization: { name: "ACME", slug: "acme" },
      offices: [{ city: "Paris", state: "Ile-de-France", country_code: "FR" }],
      published_at_date: "2026-10-01",
      contract_type: "apprenticeship",
    })
    expect(r).toEqual({
      id: "acme/data-scientist-alternance_paris",
      title: "Data Scientist - Alternance",
      company: "ACME",
      location: "Paris, Ile-de-France",
      date: "2026-10-01",
      url: "https://www.welcometothejungle.com/fr/companies/acme/jobs/data-scientist-alternance_paris",
      contract: "apprenticeship",
      remote: null,
      summary: null,
    })
  })

  test("hitToResult drops a hit without slug", () => {
    expect(hitToResult({ name: "x", organization: { slug: "a" } })).toBeNull()
  })

  test("buildFilters always scopes to France and quotes values", () => {
    expect(buildFilters({ region: "Ile-de-France", contract: "apprenticeship", sinceTs: 100 })).toBe(
      'offices.country_code:"FR" AND offices.state:"Ile-de-France" AND contract_type:"apprenticeship" AND published_at_timestamp >= 100',
    )
  })

  test("normalizeId accepts ids and WTTJ URLs, rejects other hosts", () => {
    expect(normalizeId("acme/job_paris")).toBe("acme/job_paris")
    expect(normalizeId("https://www.welcometothejungle.com/fr/companies/acme/jobs/job_paris?q=1")).toBe("acme/job_paris")
    expect(normalizeId("https://evil.io/fr/companies/acme/jobs/job_paris")).toBeNull()
    expect(normalizeId("https://welcometothejungle.com.evil.io/fr/companies/a/jobs/b")).toBeNull()
  })

  test("parseJobPosting reads JSON-LD and turns HTML into text", () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage"}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Data &amp; IA","datePosted":"2026-10-01T00:00:00Z",
      "hiringOrganization":{"name":"ACME"},"jobLocation":[{"address":{"addressLocality":"Paris","postalCode":"75001"}}],
      "description":"<p>Missions :</p><ul><li>Python</li><li>SQL</li></ul>"}</script>`
    const p = parseJobPosting(html)!
    expect(p.title).toBe("Data & IA")
    expect(p.company).toBe("ACME")
    expect(p.location).toBe("Paris 75001")
    expect(p.datePosted).toBe("2026-10-01")
    expect(p.description).toBe("Missions :\n\n- Python\n- SQL")
  })
})

describe("flag validation", () => {
  test("unknown flag exits 1 with JSON error", async () => {
    const r = await runCLI(["search", "--bogus", "1"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("UNKNOWN_FLAG")
  })
  test("bad contract exits 1", async () => {
    const r = await runCLI(["search", "--contract", "cdi"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })
  test("fractional --jobage exits 1", async () => {
    const r = await runCLI(["search", "--jobage", "0.5"])
    expect(r.exitCode).toBe(1)
  })
  test("detail without id exits 1", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })
})

describe("live smoke", () => {
  test("search returns real results with the contract fields", async () => {
    const out = parseJSON<{ results: { id: string; title: string; url: string }[] }>(
      await runCLI(["search", "-q", "data", "-r", "Ile-de-France", "--limit", "3"]),
    )
    expect(out.results.length).toBeGreaterThan(0)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toStartWith("https://www.welcometothejungle.com/fr/companies/")
    }
  })
})
