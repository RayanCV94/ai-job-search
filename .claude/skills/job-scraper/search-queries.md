# Search Queries for Job Scraper

<!-- Market: France, Paris / Ile-de-France. Target: alternance (apprenticeship) Data Scientist, Master level. -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Enabled for the French market:

| CLI | What it covers | How to scope it to this search |
|---|---|---|
| `labonnealternance-search` | French State apprenticeship portal (France Travail + partner boards) | `-l "Paris" --radius 30` (offers only, spontaneous-application companies excluded by default) |
| `wttj-search` | Welcome to the Jungle (tech, data, startups, large groups) | `-r "Ile-de-France" -c apprenticeship` |
| `linkedin-search` | LinkedIn public listings | `-l "Paris, Île-de-France, France"` (the bare "Île-de-France, France" string resolves to the wrong place) |
| `freehire-search` | freehire.me aggregator | `--country FR` |

The four Danish portals ship disabled (`enabled: false`) and stay off.

The `site:` query templates below are the **WebSearch fallback** — for boards without a CLI or when a CLI fails. HelloWork and APEC have no CLI on purpose: HelloWork's robots.txt disallows its search pages, and APEC sits behind DataDome bot protection, so they are covered only through WebSearch.

**Language scope:** every category is written in French and English: French postings dominate in Paris, but many large groups and startups post in English.

## Search Sites

Primary (CLIs):
- **labonnealternance.apprentissage.beta.gouv.fr** - all apprenticeship offers, State portal
- **welcometothejungle.com** - tech/data offers, many alternances
- **linkedin.com/jobs** - LinkedIn listings, Paris area
- **freehire.me** - aggregator, France

Fallback (WebSearch only):
- **hellowork.com** - large French general board, many alternances
- **apec.fr** - executive/Bac+5 board
- **jobteaser.com** - student board (school partnerships)
- **indeed.fr** - general board

## Query Categories

**Organize by function, not job title.** The same work is posted as "Data Scientist", "Data Analyst", "Machine Learning Engineer" or "Chargé d'études statistiques" depending on the company.

### Priority 1: Data Science / Machine Learning (alternance)

CLI keywords: `data scientist`, `machine learning`, `data science`, `IA`, `data` (broad, for WTTJ which requires every word).

```
site:hellowork.com/fr-fr/emplois "data scientist" alternance Paris
site:welcometothejungle.com "data scientist" alternance
site:linkedin.com/jobs "data scientist" alternance Paris
site:apec.fr "data scientist" alternance Île-de-France
site:jobteaser.com "data scientist" alternance Paris
"data scientist" apprenticeship Paris
"machine learning" alternance Paris
```

### Priority 2: Data Analysis / Statistics (alternance)

CLI keywords: `data analyst`, `analyste de données`, `statisticien`, `chargé d'études statistiques`, `business intelligence`.

```
site:hellowork.com/fr-fr/emplois "data analyst" alternance Paris
site:hellowork.com/fr-fr/emplois "chargé d'études statistiques" alternance
site:linkedin.com/jobs "data analyst" alternance Paris
"data analyst" apprenticeship Paris
```

### Priority 3: Data Engineering / MLOps (adjacent)

CLI keywords: `data engineer`, `ingénieur data`, `MLOps`.

```
site:hellowork.com/fr-fr/emplois "data engineer" alternance Paris
site:linkedin.com/jobs "data engineer" alternance Paris
```

### Priority 4: Broader quantitative roles

CLI keywords: `actuariat`, `biostatistique`, `quantitative`, `risk analyst`.

```
site:hellowork.com/fr-fr/emplois alternance actuariat Paris
site:hellowork.com/fr-fr/emplois alternance biostatistique Île-de-France
```

## Location Filter

Commute from Paris by public transport:
- Paris (75) and the inner ring: Hauts-de-Seine (92, La Défense, Boulogne, Nanterre), Seine-Saint-Denis (93), Val-de-Marne (94) - ideal
- Outer ring with a direct RER/Transilien line: Massy, Palaiseau / Saclay, Cergy, Saint-Quentin-en-Yvelines, Marne-la-Vallée - acceptable
- Rest of Ile-de-France (Meaux, Melun, Rambouillet...) - borderline (~1h15+ by transit)
- Outside Ile-de-France - too far, unless the offer is full remote

## Language Filter

Apply `04-job-evaluation.md`'s Language Gate with the Languages table in CLAUDE.md. Postings in English are fine; a posting requiring a language not declared there is excluded.

## Date Filter

Only include offers posted within the last 14 days, or with an application deadline (`validThrough`) that has not passed. Alternance offers for a September start are posted from January to September: an older offer with a future deadline is still valid. If a posting date cannot be determined, include it but flag it as "date unknown".

## Contract Filter

Keep **alternance** offers: apprentissage and contrat de professionnalisation. A "Stage / Alternance" title is fine. Pure internships (stage only), CDI and CDD are out unless the user asks for them.

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape NLP" -> Priority 1 queries + `"NLP" alternance Paris`, `"traitement du langage" alternance`
