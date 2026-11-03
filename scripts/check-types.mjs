#!/usr/bin/env node
// Checks that src/api/types.ts keeps up with shop-api's api/openapi.yaml:
// every schema in components.schemas needs an interface (or object type) of
// the same name here, with every one of the schema's fields.
//
// The spec is read from shop-api at the branch with the same name as this
// one (agnts gives a multi-repo ticket the same branch in every repo), and
// from main when that branch does not exist there.
//
// Environment:
//   SHOP_API_REPO   owner/name of shop-api on GitHub (default abdusalomovrustambek/shop-api)
//   SHOP_API_TOKEN  optional GitHub token, for a private shop-api
//   SHOP_API_SPEC   path to a local openapi.yaml; skips GitHub (for local runs)
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { parse } from 'yaml'

const TYPES_FILE = fileURLToPath(new URL('../src/api/types.ts', import.meta.url))
const SPEC_PATH = 'api/openapi.yaml'
const DEFAULT_REPO = 'abdusalomovrustambek/shop-api'
const FALLBACK_BRANCH = 'main'

/** The branch this check runs for: the PR's head branch in CI, else the pushed ref, else git. */
export function currentBranch(env = process.env) {
  if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
}

/** Fetches the spec at a branch; resolves to null when the branch or file does not exist. */
export async function fetchSpec(repo, branch, token, fetchImpl = fetch) {
  const url = token
    ? `https://api.github.com/repos/${repo}/contents/${SPEC_PATH}?ref=${encodeURIComponent(branch)}`
    : `https://raw.githubusercontent.com/${repo}/${branch.split('/').map(encodeURIComponent).join('/')}/${SPEC_PATH}`
  const headers = token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' } : {}
  let response
  try {
    response = await fetchImpl(url, { headers })
  } catch (error) {
    const reason = error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error)
    throw new Error(`Could not reach ${url}: ${reason}`, { cause: error })
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Fetching ${SPEC_PATH} from ${repo}@${branch} failed: HTTP ${response.status}`)
  return response.text()
}

/** Loads the spec text and says where it came from. Throws when there is none. */
export async function loadSpec(env = process.env, fetchImpl = fetch) {
  if (env.SHOP_API_SPEC) {
    return { source: env.SHOP_API_SPEC, text: await readFile(env.SHOP_API_SPEC, 'utf8') }
  }
  const repo = env.SHOP_API_REPO || DEFAULT_REPO
  const token = env.SHOP_API_TOKEN || undefined
  const branch = currentBranch(env)
  const branches = branch === FALLBACK_BRANCH ? [branch] : [branch, FALLBACK_BRANCH]
  for (const candidate of branches) {
    const text = await fetchSpec(repo, candidate, token, fetchImpl)
    if (text !== null) return { source: `${repo}@${candidate}:${SPEC_PATH}`, text }
  }
  throw new Error(`${SPEC_PATH} was not found in ${repo} at ${branches.join(' or ')}`)
}

/** Maps each schema in components.schemas to its field names, following allOf and $ref. */
export function schemaFields(spec) {
  const schemas = spec?.components?.schemas
  if (typeof schemas !== 'object' || schemas === null) {
    throw new Error('The spec has no components.schemas')
  }

  function fieldsOf(schema, seen) {
    const fields = new Set()
    if (typeof schema !== 'object' || schema === null) return fields
    if (typeof schema.$ref === 'string') {
      const name = schema.$ref.replace('#/components/schemas/', '')
      if (seen.has(name)) return fields
      return fieldsOf(schemas[name], new Set([...seen, name]))
    }
    for (const key of Object.keys(schema.properties ?? {})) fields.add(key)
    for (const part of schema.allOf ?? []) {
      for (const key of fieldsOf(part, seen)) fields.add(key)
    }
    return fields
  }

  const result = new Map()
  for (const [name, schema] of Object.entries(schemas)) {
    const fields = fieldsOf(schema, new Set([name]))
    // Enums and other non-object schemas have no fields to check.
    if (fields.size > 0) result.set(name, fields)
  }
  return result
}

/** Maps each interface and object type alias in a TypeScript source to its property names. */
export function typeFields(source, fileName = 'types.ts') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const own = new Map()
  const parents = new Map()

  function membersOf(node) {
    const names = new Set()
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) names.add(member.name.getText(file).replace(/['"]/g, ''))
      }
    } else if (ts.isIntersectionTypeNode(node)) {
      for (const part of node.types) for (const name of membersOf(part)) names.add(name)
    } else if (ts.isTypeReferenceNode(node)) {
      names.add(`@extends:${node.typeName.getText(file)}`)
    }
    return names
  }

  function split(name, names) {
    const fields = new Set()
    const extendsNames = []
    for (const entry of names) {
      if (entry.startsWith('@extends:')) extendsNames.push(entry.slice('@extends:'.length))
      else fields.add(entry)
    }
    own.set(name, fields)
    parents.set(name, extendsNames)
  }

  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      const names = new Set()
      for (const member of statement.members) {
        if (ts.isPropertySignature(member) && member.name) names.add(member.name.getText(file).replace(/['"]/g, ''))
      }
      for (const clause of statement.heritageClauses ?? []) {
        for (const type of clause.types) names.add(`@extends:${type.expression.getText(file)}`)
      }
      split(statement.name.text, names)
    } else if (ts.isTypeAliasDeclaration(statement)) {
      const names = membersOf(statement.type)
      if (names.size > 0) split(statement.name.text, names)
    }
  }

  function resolve(name, seen) {
    const fields = new Set(own.get(name) ?? [])
    for (const parent of parents.get(name) ?? []) {
      if (seen.has(parent)) continue
      for (const field of resolve(parent, new Set([...seen, parent]))) fields.add(field)
    }
    return fields
  }

  const result = new Map()
  for (const name of own.keys()) result.set(name, resolve(name, new Set([name])))
  return result
}

/** Lists what types.ts lacks compared with the spec; empty when nothing is missing. */
export function compareTypes(schemas, types) {
  const problems = []
  for (const [name, fields] of schemas) {
    const typed = types.get(name)
    if (!typed) {
      problems.push(`${name}: no interface or type named ${name} in src/api/types.ts`)
      continue
    }
    for (const field of fields) {
      if (!typed.has(field)) problems.push(`${name}.${field}: missing from src/api/types.ts`)
    }
  }
  return problems
}

async function main() {
  const spec = await loadSpec()
  const schemas = schemaFields(parse(spec.text))
  const types = typeFields(await readFile(TYPES_FILE, 'utf8'), TYPES_FILE)
  const problems = compareTypes(schemas, types)
  if (problems.length > 0) {
    console.error(`src/api/types.ts is out of date with ${spec.source}:`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
    return
  }
  console.log(`src/api/types.ts has every field of the ${schemas.size} schemas in ${spec.source}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`check-types: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
