# Welcome to the Jungle - URL reference

## Search (Algolia, public search-only key)

`POST https://csekhvms53-dsn.algolia.net/1/indexes/wttj_jobs_production_fr/query`

Headers: `X-Algolia-Application-Id: CSEKHVMS53`, `X-Algolia-API-Key: 4bd8f6215d0cc52b26430765769e65a0`,
`Referer: https://www.welcometothejungle.com/` (without it: `403 Method not allowed with this referer`).

Body fields used: `query`, `hitsPerPage`, `page` (0-based), `filters`, `attributesToRetrieve`.

| Filter | Example |
|---|---|
| Country | `offices.country_code:"FR"` |
| Region | `offices.state:"Ile-de-France"` (no accent) |
| Contract | `contract_type:"apprenticeship"` (also `internship`, `full_time`, `temporary`, `freelance`, `part_time`, `graduate_program`, `vie`) |
| Freshness | `published_at_timestamp >= <unix seconds>` |

Hit fields read: `name`, `slug`, `organization.name`, `organization.slug`, `offices[].city/state`,
`published_at_date`, `contract_type`, `remote`, `summary`. Response: `hits`, `nbHits`.

If the key stops working, open welcometothejungle.com/fr/jobs in a browser and read the
`x-algolia-api-key` / application id from the network request to `*.algolia.net`.

## Job page (detail)

`https://www.welcometothejungle.com/fr/companies/<organization.slug>/jobs/<slug>`

Parsed from the `<script type="application/ld+json">` block with `"@type":"JobPosting"`
(`title`, `hiringOrganization.name`, `jobLocation[].address`, `datePosted`, `validThrough`,
`employmentType`, `description` as HTML). robots.txt allows this path (checked 2026-10-17).
