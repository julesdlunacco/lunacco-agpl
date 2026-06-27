import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Luna AstroHD module build config.
 *
 * Mirrors luna-numerology's IIFE setup:
 *  - Externalises react/react-dom → uses shared globals from lunacco-core-app.
 *  - framer-motion read from window.FramerMotion via virtual module.
 *  - Output: assets/luna-astrohd-module.js (IIFE, no minify for debuggability).
 */

const framerMotionVirtualPlugin = {
  name: 'framer-motion-virtual',
  resolveId( id ) {
    if ( id === 'framer-motion' ) return '\0virtual:framer-motion';
  },
  load( id ) {
    if ( id === '\0virtual:framer-motion' ) {
      return `
const _fm = window.FramerMotion;
export const motion          = _fm.motion;
export const AnimatePresence = _fm.AnimatePresence;
export default _fm;
`;
    }
  },
};

export default defineConfig( {
  plugins: [ react(), tailwindcss(), framerMotionVirtualPlugin ],
  build: {
    minify: false,
    rollupOptions: {
      input: 'src/main.jsx',
      external: [ 'react', 'react/jsx-runtime', 'react-dom' ],
      output: {
        format: 'iife',
        name: 'LunaAstroHDModule',
        globals: {
          react:               'React',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react-dom':         'ReactDOM',
        },
        entryFileNames: 'assets/luna-astrohd-module.js',
        chunkFileNames:  'assets/[name].js',
        assetFileNames:  'assets/[name].[ext]',
      },
    },
  },
} );
