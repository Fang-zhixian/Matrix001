import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('/reactflow/') || id.includes('/@reactflow/')) {
    return 'reactflow';
  }

  if (
    id.includes('/firebase/firestore') ||
    id.includes('/@firebase/firestore') ||
    id.includes('/@firebase/webchannel-wrapper')
  ) {
    return 'firebase-firestore';
  }

  if (
    id.includes('/firebase/auth') ||
    id.includes('/@firebase/auth')
  ) {
    return 'firebase-auth';
  }

  if (
    id.includes('/firebase/app') ||
    id.includes('/@firebase/app') ||
    id.includes('/@firebase/component') ||
    id.includes('/@firebase/util') ||
    id.includes('/@firebase/logger')
  ) {
    return 'firebase-core';
  }

  if (
    id.includes('/react-markdown/') ||
    id.includes('/highlight.js/') ||
    id.includes('/remark-') ||
    id.includes('/rehype-') ||
    id.includes('/micromark/') ||
    id.includes('/mdast-') ||
    id.includes('/unist-') ||
    id.includes('/vfile/')
  ) {
    return 'markdown';
  }

  if (id.includes('/motion/') || id.includes('/framer-motion/')) {
    return 'motion';
  }

  if (id.includes('/lucide-react/')) {
    return 'icons';
  }

  if (id.includes('/@google/genai/')) {
    return 'ai';
  }

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/scheduler/')
  ) {
    return 'react-core';
  }

  return undefined;
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENAI_COMPATIBLE_API_KEY': JSON.stringify(env.OPENAI_COMPATIBLE_API_KEY),
      'process.env.OPENAI_COMPATIBLE_BASE_URL': JSON.stringify(env.OPENAI_COMPATIBLE_BASE_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
