// Wrap tsc's CommonJS output in the dsh client module format (lib/client.js).
import { readFileSync, writeFileSync } from 'node:fs'

// tsc's "use strict" moves to the top of the factory, where it acts as a directive.
const read = (file) => readFileSync(file, 'utf8').replace(/^"use strict";\n/, '')
writeFileSync(
  'lib/client.js',
  `window.__ModuleLoader__.load({
  id: 'dsh-ui-scale',
  factory: (load) => {
    'use strict'
    const shim = { exports: {} };
    ((module, exports) => {
${read('lib/shim.cjs')}
    })(shim, shim.exports)
    const require = id => id === './shim.cjs' ? shim.exports : load(id)
    const module = { exports: {} }
    const exports = module.exports
${read('lib/client.cjs')}
    return module.exports
  },
})
`,
)
