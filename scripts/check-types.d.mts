// Types for the functions scripts/check-types.mjs exports, so its test is type-checked.
export type SchemaFields = Map<string, Set<string>>

export function currentBranch(env?: Record<string, string | undefined>): string
export function fetchSpec(
  repo: string,
  branch: string,
  token: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<string | null>
export function loadSpec(
  env?: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): Promise<{ source: string; text: string }>
export function schemaFields(spec: unknown): SchemaFields
export function typeFields(source: string, fileName?: string): SchemaFields
export function compareTypes(schemas: SchemaFields, types: SchemaFields): string[]
