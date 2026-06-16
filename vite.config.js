import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  
  build: {
    // Enable source maps for production debugging (hidden from browser DevTools by default)
    sourcemap: 'hidden',
    
    rollupOptions: {
      output: {
        // Explicit chunk splitting — reduces initial bundle size
        manualChunks: {
          // Web3 core libraries
          'web3-core':    ['wagmi', 'viem'],
          'web3-reown':   ['@reown/appkit', '@reown/appkit-adapter-wagmi'],
          'web3-query':   ['@tanstack/react-query'],
          
          // Backend/database
          'supabase':     ['@supabase/supabase-js'],
          
          // React ecosystem
          'react-core':   ['react', 'react-dom'],
          'react-router': ['react-router-dom'],
        },
        
        // Optimize chunk file naming for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // ESBuild minification (faster than Terser, good balance)
    minify: 'esbuild',
    
    // Target modern browsers for smaller bundle size
    target: ['es2022', 'chrome109', 'safari16', 'firefox115'],
    
    esbuildOptions: {
      // Remove console/debugger in production
      drop: ['console', 'debugger'],
      treeShaking: true,
      legalComments: 'none',
      
      // Enable dead code elimination
      pure: ['console.log', 'console.info', 'console.debug'],
    },
    
    // Split CSS into separate files per chunk
    cssCodeSplit: true,
    
    // Inline assets smaller than 4kb (base64)
    assetsInlineLimit: 4096,
    
    // Increase chunk size warning limit (we're manually splitting chunks)
    chunkSizeWarningLimit: 1500,
    
    // Enable CSS minification
    cssMinify: true,
  },
  
  // Development server optimization
  server: {
    // Enable CORS for local development
    cors: true,
    
    // Warm up frequently used files on server start
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/pages/Home.jsx',
        './src/lib/wagmi.js',
      ],
    },
  },
  
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'wagmi',
      'viem',
      '@tanstack/react-query',
    ],
  },
})