/*
 * Types for the CLI module (`@awflow/avatar/cli`), used by
 * @awflow/avatar-export's own CLI to share the parser and the runner.
 */

/** Where main() writes: bytes or text out, one line of error text. */
export type CliIO = {
  out(data: Uint8Array | string): void
  err(text: string): void
  /**
   * The sheet's stdin. Reading more than `maxBytes + 1` bytes is never
   * needed: a longer input is refused.
   */
  stdin(maxBytes: number): string
  /** Loads the raster package; defaults to importing @awflow/avatar-export. */
  loadExport?: () => Promise<unknown>
}

/** Runs the CLI against `io`. Resolves to the exit code. */
export function main(argv: readonly string[], io: CliIO): Promise<number>

/** main() wired to the process: stdout, stderr and the exit code. */
export function run(
  argv: readonly string[],
  loadExport?: () => Promise<unknown>,
): Promise<void>
