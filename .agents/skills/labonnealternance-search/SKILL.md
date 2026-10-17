---
name: labonnealternance-search
version: 1.0.0
description: >
  Use this skill to search apprenticeship (alternance / apprentissage /
  contrat de professionnalisation) offers in France on La bonne alternance, the
  French State portal that aggregates France Travail and partner job boards. Use it
  whenever the user looks for an alternance, e.g. data scientist or data analyst
  near Paris. Trigger phrases: find an apprenticeship in France, alternance,
  trouver une alternance, offre d'alternance, apprentissage, contrat pro,
  La bonne alternance.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/labonnealternance-search/cli/src/cli.ts *)
---

# La bonne alternance Search Skill

Searches live apprenticeship offers on labonnealternance.apprentissage.beta.gouv.fr
(French State, beta.gouv.fr). No account, no API key, zero runtime dependencies.
`--location` is geocoded with the national address API (api-adresse.data.gouv.fr).

## Commands

### Search

```bash
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts search [flags]
```

- `--query` / `-q <text>` - keywords, e.g. `"data scientist"`, `"data analyst"`, `"data"`.
- `--location` / `-l <text>` - city, postcode or address, e.g. `"Paris"`, `"92100"`. Omit for all of France.
- `--radius <km>` - radius around `--location`, default 30.
- `--jobage <days>` - posted within N days (client-side filter on the publication date; undated offers are kept).
- `--spontanees` - also list "candidatures spontanées": companies likely to hire an apprentice, **not** posted offers. Off by default; results then carry `kind: "candidature_spontanee"`.
- `--page <n>` - 1-indexed, 50 results per page.
- `--limit` / `-n <n>` - client-side cap.
- `--format json|table|plain` - default `json`.

Results are sorted by publication date, newest first.

### Detail

```bash
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts detail <sub_type/id|url> [--format json|plain]
```

`id` is the `sub_type/id` from search results (e.g. `offres_emploi_partenaires/6aa86fe99dceff7dd4b89948`)
or a full `labonnealternance.apprentissage.beta.gouv.fr/emploi/...` URL. Returns title, company,
location, publication date, `validThrough` (deadline) and the description.

## Usage examples

```bash
# Alternance data scientist within 30 km of Paris
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts search -q "data scientist" -l "Paris" --format table

# Alternance data, last 14 days, around Paris
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts search -q "data" -l "Paris" --jobage 14 --format table

# Data analyst, 50 km around La Défense
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts search -q "data analyst" -l "92800" --radius 50 --format table

# Full description of one offer
bun run .agents/skills/labonnealternance-search/cli/src/cli.ts detail offres_emploi_partenaires/6aa86fe99dceff7dd4b89948 --format plain
```

## Output

JSON: `{ "meta": { "count", "page", "total", "place" }, "results": [ { "id", "title", "company", "location", "date", "url", "kind", "contract", "level", "distanceKm" } ] }`.
`level` is the target diploma (e.g. "Master, titre ingénieur, grande école (Bac+5)"). Missing values are `null`.
Errors go to stderr as `{ "error", "code" }` with exit code 1.

## Notes

- The search is semantic: `"data scientist"` also returns data engineer / data analyst offers. Check titles.
- `detail` on a `recruteurs_lba/...` id returns `NOT_FOUND`: those are companies, not offers.
- Endpoints and parameters: `url-reference.md`.
