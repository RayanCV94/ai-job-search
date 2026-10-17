# La bonne alternance - URL reference

## Search

`GET https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/search`

Found 2026-10-17 by watching the site's own search page (`/recherche`). The older
`/api/v1/jobs` and `/api/v1/jobsEtFormations` endpoints return 404.

| Parameter | Meaning |
|---|---|
| `q` | keywords (semantic) |
| `mode` | `emplois` (offers) |
| `latitude`, `longitude`, `radius` | geographic filter, radius in km |
| `hitsPerPage`, `page` | paging, `page` 0-based |
| `type_filter_label` | repeat once per value: `Offres d'emploi partenaires`, `Offres d'emploi La bonne alternance`, `Candidatures spontanées`. Comma-joined values return 0 hits. |

Unknown parameters are rejected (`querystring.: Unrecognized key`).

Response: `hits[]`, `nbHits`, `nbPages`, `facets`. Hit fields read: `url_id`, `sub_type`
(`offres_emploi_partenaires`, `offres_emploi_lba`, `recruteurs_lba`), `title`,
`organization_name`, `address`, `publication_date`, `contract_type[]`, `level`, `distance`.

## Job page (detail)

`https://labonnealternance.apprentissage.beta.gouv.fr/emploi/<sub_type>/<url_id>/<any-slug>`

Parsed from the `<script type="application/ld+json">` JobPosting block. `recruteurs_lba`
pages carry no JobPosting.

## Geocoding

`GET https://api-adresse.data.gouv.fr/search/?q=<place>&limit=1` -> `features[0].geometry.coordinates` = `[lon, lat]`.

robots.txt allows `/api/` and `/emploi/` (checked 2026-10-17).
