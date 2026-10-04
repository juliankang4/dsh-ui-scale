// Wrap tsc's CommonJS output in the dsh client module format (lib/client.js).
import { readFileSync, writeFileSync } from 'node:fs'

// tsc's "use strict" moves to the top of the factory, where it acts as a directive.
const body = readFileSync('lib/client.cjs', 'utf8').replace(/^"use strict";\n/, '')
writeFileSync('lib/client.js', `window.__ModuleLoader__.load({
  id: 'dsh-ui-scale',
  factory: (require) => {
    'use strict'
    const module = { exports: {} }
    const exports = module.exports
${body}
    return module.exports
  },
})
`)
