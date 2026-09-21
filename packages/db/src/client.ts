import postgres from "postgres";
import type { Sql, Options } from "postgres";

/**
 * Create a postgres-js client. `prepare: false` is required under PgBouncer
 * transaction mode (D13); it is harmless on a direct connection.
 */
export function makeClient(
  url: string,
  opts: Options<Record<string, never>> = {},
): Sql {
  return postgres(url, { prepare: false, ...opts });
}

export type { Sql };
