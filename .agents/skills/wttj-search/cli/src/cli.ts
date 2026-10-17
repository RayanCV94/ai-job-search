#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Welcome to the Jungle (France).
// Zero runtime dependencies: plain bun + fetch. Personal use only - keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { CONTRACTS } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", r: "region", n: "limit", c: "contract" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `wttj-cli - search jobs on Welcome to the Jungle (France)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <company/job|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill). e.g. "data scientist"
  --region, -r <text>     French region as WTTJ spells it, e.g. "Ile-de-France" (no accent).
  --contract, -c <type>   ${CONTRACTS.join(" | ")}
  --jobage <days>         Posted within N days.
  --page <n>              1-indexed page (30 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "data scientist" -r "Ile-de-France" -c apprenticeship --jobage 14 --format table
  bun run src/cli.ts search -q "machine learning" -c internship --format table
  bun run src/cli.ts detail axa/data-scientist-f-h-alternance_nanterre --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "region", "contract", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function fail(error: string, code: string): number {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  return 1
}

function intFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    fail(`--${name} must be a whole number of at least 1, got "${raw}"`, "BAD_ARG")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      return fail(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help`,
        "UNKNOWN_FLAG",
      )
    }
  }

  if (cmd === "search") {
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) return fail(`--format must be one of json|table|plain, got "${fmt}"`, "BAD_ARG")
    for (const k of ["query", "region", "contract"]) {
      if (flags[k] !== undefined && typeof flags[k] !== "string") return fail(`--${k} needs a value`, "BAD_ARG")
    }
    const contract = flags.contract as string | undefined
    if (contract !== undefined && !(CONTRACTS as readonly string[]).includes(contract)) {
      return fail(`--contract must be one of ${CONTRACTS.join("|")}, got "${contract}"`, "BAD_ARG")
    }
    const nums: Record<string, number | undefined> = {}
    for (const k of ["jobage", "page", "limit"]) {
      if (flags[k] === undefined) continue
      const v = intFlag(k, flags[k])
      if (v === null) return 1
      nums[k] = v
    }
    const opts: SearchOpts = {
      query: flags.query as string | undefined,
      region: flags.region as string | undefined,
      contract,
      jobage: nums.jobage,
      page: nums.page ?? 1,
      limit: nums.limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) return fail("detail requires a <company/job|url>", "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) return fail(`--format must be one of json|plain, got "${fmt}"`, "BAD_ARG")
    const opts: DetailOpts = { id, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  return fail(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n")
    process.exit(1)
  })
