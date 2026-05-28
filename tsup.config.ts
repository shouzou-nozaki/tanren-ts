import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
})
