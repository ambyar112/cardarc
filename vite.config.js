import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  build: {
    rollupOptions: {
      output: {
        // Object-based manualChunks — proven working, explicit mapping
        manualChunks: {
          'web3-core':    ['wagmi', 'viem'],
          'web3-reown':   ['@reown/appkit', '@reown/appkit-adapter-wagmi'],
          'web3-query':   ['@tanstack/react-query'],
          'supabase':     ['@supabase/supabase-js'],
          'react-core':   ['react', 'react-dom'],
          'react-router': ['react-router-dom'],
        },
      },
    },
    minify: 'esbuild',
    target: ['es2022', 'chrome109', 'safari16', 'firefox115'],
    esbuildOptions: {
      drop: ['console', 'debugger'],
      treeShaking: true,
      legalComments: 'none',
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
  },
})
