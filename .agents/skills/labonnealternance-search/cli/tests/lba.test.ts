import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers"
import { hitToResult, normalizeId, parseJobPosting, slugify } from "../src/helpers"

describe("parsing (offline)", () => {
  test("hitToResult maps an API hit to the contract fields", () => {
    const r = hitToResult({
      url_id: "6aa86fe99dceff7dd4b89948",
      sub_type: "offres_emploi_partenaires",
      title: "Data Scientist &amp; IA H/F",
      organization_name: "Rothschild &amp; Co",
      address: "75008 Paris",
      publication_date: "2026-09-28T20:15:05.000Z",
      contract_type: ["Apprentissage", "Professionnalisation"],
      level: "Master (Bac+5)",
      distance: 3.14159,
    })
    expect(r).toEqual({
      id: "offres_emploi_partenaires/6aa86fe99dceff7dd4b89948",
      title: "Data Scientist & IA H/F",
      company: "Rothschild & Co",
      location: "75008 Paris",
      date: "2026-09-28",
      url: "https://labonnealternance.apprentissage.beta.gouv.fr/emploi/offres_emploi_partenaires/6aa86fe99dceff7dd4b89948/data-scientist-ia-h-f",
      kind: "offre",
      contract: "Apprentissage, Professionnalisation",
      level: "Master (Bac+5)",
      distanceKm: 3.1,
    })
  })

  test("spontaneous-application entries are labelled as such", () => {
    expect(hitToResult({ url_id: "123", sub_type: "recruteurs_lba", title: "ACME" })!.kind).toBe("candidature_spontanee")
  })

  test("slugify strips accents and symbols", () => {
    expect(slugify("Ingénieur Data / IA (H/F)")).toBe("ingenieur-data-ia-h-f")
  })

  test("normalizeId accepts ids and LBA URLs, rejects other hosts", () => {
    expect(normalizeId("offres_emploi_lba/abc123")).toBe("offres_emploi_lba/abc123")
    expect(
      normalizeId("https://labonnealternance.apprentissage.beta.gouv.fr/emploi/offres_emploi_partenaires/6aa8/x?from=y"),
    ).toBe("offres_emploi_partenaires/6aa8")
    expect(normalizeId("https://evil.io/emploi/offres_emploi_lba/abc")).toBeNull()
  })

  test("parseJobPosting reads the JSON-LD block", () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","title":"Data Analyst","validThrough":"2026-11-28T00:00:00Z",
      "hiringOrganization":{"name":"ACME"},"jobLocation":{"address":{"addressLocality":"Cergy","postalCode":"95000"}},"description":"Line 1\\nLine 2"}</script>`
    const p = parseJobPosting(html)!
    expect(p.title).toBe("Data Analyst")
    expect(p.location).toBe("Cergy 95000")
    expect(p.validThrough).toBe("2026-11-28")
    expect(p.description).toBe("Line 1\nLine 2")
  })
})

describe("flag validation", () => {
  test("unknown flag exits 1 with JSON error", async () => {
    const r = await runCLI(["search", "--bogus", "1"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("UNKNOWN_FLAG")
  })
  test("--radius without --location exits 1", async () => {
    const r = await runCLI(["search", "--radius", "10"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })
  test("detail with a foreign URL exits 1", async () => {
    const r = await runCLI(["detail", "https://evil.io/emploi/a/b"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ID")
  })
})

describe("live smoke", () => {
  test("search returns real offers around Paris", async () => {
    const out = parseJSON<{ results: { id: string; title: string; url: string; kind: string }[] }>(
      await runCLI(["search", "-q", "data", "-l", "Paris", "--limit", "3"]),
    )
    expect(out.results.length).toBeGreaterThan(0)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.kind).toBe("offre")
      expect(r.url).toStartWith("https://labonnealternance.apprentissage.beta.gouv.fr/emploi/")
    }
  })
})
