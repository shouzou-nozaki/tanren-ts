import { defineConfig } from 'tsup'
import { version } from './package.json'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
  define: { __APP_VERSION__: JSON.stringify(version) },
})
