---
name: wttj-search
version: 1.0.0
description: >
  Use this skill to search job offers on Welcome to the Jungle (welcometothejungle.com),
  the main French job board for tech, data and startup roles - including alternance
  (apprenticeship), stage (internship) and CDI. Use it for any job search in France,
  e.g. data scientist, data analyst, machine learning engineer in Paris / Ile-de-France.
  Trigger phrases: find a job in France, search jobs Paris, alternance data scientist,
  chercher une offre, offres d'emploi, trouver une alternance, stage data, emploi Paris,
  Welcome to the Jungle, WTTJ.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/wttj-search/cli/src/cli.ts *)
---

# Welcome to the Jungle Search Skill

Searches live offers on Welcome to the Jungle (France). No account, no API key, zero
runtime dependencies (plain `bun`). Search goes through the public search-only index the
site itself ships to every browser; `detail` reads the public job page.

## Personal use only

Keep volume low (a few queries per run, never a crawl) and do not use the data commercially.

## Commands

### Search

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts search [flags]
```

- `--query` / `-q <text>` - keywords. Use short terms: the index requires every word, so `"data"` finds far more than `"data scientist alternance"`.
- `--region` / `-r <text>` - French region as WTTJ spells it, **without accent**: `"Ile-de-France"`, `"Auvergne-Rhone-Alpes"`, `"Provence-Alpes-Cote d'Azur"`.
- `--contract` / `-c <type>` - `apprenticeship` (alternance), `internship` (stage), `full_time` (CDI), `temporary` (CDD), `freelance`, `part_time`, `graduate_program`, `vie`.
- `--jobage <days>` - posted within N days (server-side filter).
- `--page <n>` - 1-indexed, 30 results per page.
- `--limit` / `-n <n>` - client-side cap.
- `--format json|table|plain` - default `json`.

Results are always scoped to offices in France.

### Detail

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts detail <company/job|url> [--format json|plain]
```

`id` is the `company-slug/job-slug` from search results, or a full
`welcometothejungle.com/fr/companies/<company>/jobs/<job>` URL. Returns title, company,
location, contract, publication date, `validThrough` (deadline) and the full description.

## Usage examples

```bash
# Alternance data in Ile-de-France, last 14 days
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "data" -r "Ile-de-France" -c apprenticeship --jobage 14 --format table

# Alternance data scientist anywhere in France
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "data scientist" -c apprenticeship --format table

# Machine learning internships in Ile-de-France
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "machine learning" -r "Ile-de-France" -c internship --format table

# Full description of one offer
bun run .agents/skills/wttj-search/cli/src/cli.ts detail axa/data-scientist-f-h-alternance_nanterre --format plain
```

## Output

JSON: `{ "meta": { "count", "page", "total" }, "results": [ { "id", "title", "company", "location", "date", "url", "contract", "remote", "summary" } ] }`.
Missing values are `null`. Errors go to stderr as `{ "error", "code" }` with exit code 1.

## Notes

- The search key only answers requests carrying the site's `Referer`; the CLI sends it with an honest `wttj-search-cli/1.0` User-Agent.
- `detail` returns `NOT_FOUND` when the offer was taken down (the page then has no JobPosting data).
- Parsing anchors and endpoints: `url-reference.md`.
