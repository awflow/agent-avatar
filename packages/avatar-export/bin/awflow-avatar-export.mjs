#!/usr/bin/env node
/* `npx @awflow/avatar-export Linh --png 256`: the core CLI with this package
 * guaranteed to be the export module. */
import { run } from '@awflow/avatar/cli'

await run(process.argv.slice(2), () => import('../dist/index.js'))
