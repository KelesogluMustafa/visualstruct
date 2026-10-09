import { defineConfig } from 'vitest/config'

// The first render in a process loads fonts and the resvg binary, which takes longer than the
// 5 s default on slow CI runners.
export default defineConfig({ test: { testTimeout: 30_000 } })
