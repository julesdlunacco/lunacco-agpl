// vite.config.js
import { defineConfig } from "file:///C:/Users/llnrf/Local%20Sites/tarot-pull-core-take-2/app/public/wp-content/plugins/lunacco-astrohd/spa/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/llnrf/Local%20Sites/tarot-pull-core-take-2/app/public/wp-content/plugins/lunacco-astrohd/spa/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/llnrf/Local%20Sites/tarot-pull-core-take-2/app/public/wp-content/plugins/lunacco-astrohd/spa/node_modules/@tailwindcss/vite/dist/index.mjs";
var framerMotionVirtualPlugin = {
  name: "framer-motion-virtual",
  resolveId(id) {
    if (id === "framer-motion") return "\0virtual:framer-motion";
  },
  load(id) {
    if (id === "\0virtual:framer-motion") {
      return `
const _fm = window.FramerMotion;
export const motion          = _fm.motion;
export const AnimatePresence = _fm.AnimatePresence;
export default _fm;
`;
    }
  }
};
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss(), framerMotionVirtualPlugin],
  build: {
    minify: false,
    rollupOptions: {
      input: "src/main.jsx",
      external: ["react", "react/jsx-runtime", "react-dom"],
      output: {
        format: "iife",
        name: "LunaAstroHDModule",
        globals: {
          react: "React",
          "react/jsx-runtime": "ReactJSXRuntime",
          "react-dom": "ReactDOM"
        },
        entryFileNames: "assets/luna-astrohd-module.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxsbG5yZlxcXFxMb2NhbCBTaXRlc1xcXFx0YXJvdC1wdWxsLWNvcmUtdGFrZS0yXFxcXGFwcFxcXFxwdWJsaWNcXFxcd3AtY29udGVudFxcXFxwbHVnaW5zXFxcXGx1bmFjY28tYXN0cm9oZFxcXFxzcGFcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGxsbnJmXFxcXExvY2FsIFNpdGVzXFxcXHRhcm90LXB1bGwtY29yZS10YWtlLTJcXFxcYXBwXFxcXHB1YmxpY1xcXFx3cC1jb250ZW50XFxcXHBsdWdpbnNcXFxcbHVuYWNjby1hc3Ryb2hkXFxcXHNwYVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbGxucmYvTG9jYWwlMjBTaXRlcy90YXJvdC1wdWxsLWNvcmUtdGFrZS0yL2FwcC9wdWJsaWMvd3AtY29udGVudC9wbHVnaW5zL2x1bmFjY28tYXN0cm9oZC9zcGEvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuXG4vKipcbiAqIEx1bmEgQXN0cm9IRCBtb2R1bGUgYnVpbGQgY29uZmlnLlxuICpcbiAqIE1pcnJvcnMgbHVuYS1udW1lcm9sb2d5J3MgSUlGRSBzZXR1cDpcbiAqICAtIEV4dGVybmFsaXNlcyByZWFjdC9yZWFjdC1kb20gXHUyMTkyIHVzZXMgc2hhcmVkIGdsb2JhbHMgZnJvbSBsdW5hY2NvLWNvcmUtYXBwLlxuICogIC0gZnJhbWVyLW1vdGlvbiByZWFkIGZyb20gd2luZG93LkZyYW1lck1vdGlvbiB2aWEgdmlydHVhbCBtb2R1bGUuXG4gKiAgLSBPdXRwdXQ6IGFzc2V0cy9sdW5hLWFzdHJvaGQtbW9kdWxlLmpzIChJSUZFLCBubyBtaW5pZnkgZm9yIGRlYnVnZ2FiaWxpdHkpLlxuICovXG5cbmNvbnN0IGZyYW1lck1vdGlvblZpcnR1YWxQbHVnaW4gPSB7XG4gIG5hbWU6ICdmcmFtZXItbW90aW9uLXZpcnR1YWwnLFxuICByZXNvbHZlSWQoIGlkICkge1xuICAgIGlmICggaWQgPT09ICdmcmFtZXItbW90aW9uJyApIHJldHVybiAnXFwwdmlydHVhbDpmcmFtZXItbW90aW9uJztcbiAgfSxcbiAgbG9hZCggaWQgKSB7XG4gICAgaWYgKCBpZCA9PT0gJ1xcMHZpcnR1YWw6ZnJhbWVyLW1vdGlvbicgKSB7XG4gICAgICByZXR1cm4gYFxuY29uc3QgX2ZtID0gd2luZG93LkZyYW1lck1vdGlvbjtcbmV4cG9ydCBjb25zdCBtb3Rpb24gICAgICAgICAgPSBfZm0ubW90aW9uO1xuZXhwb3J0IGNvbnN0IEFuaW1hdGVQcmVzZW5jZSA9IF9mbS5BbmltYXRlUHJlc2VuY2U7XG5leHBvcnQgZGVmYXVsdCBfZm07XG5gO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygge1xuICBwbHVnaW5zOiBbIHJlYWN0KCksIHRhaWx3aW5kY3NzKCksIGZyYW1lck1vdGlvblZpcnR1YWxQbHVnaW4gXSxcbiAgYnVpbGQ6IHtcbiAgICBtaW5pZnk6IGZhbHNlLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGlucHV0OiAnc3JjL21haW4uanN4JyxcbiAgICAgIGV4dGVybmFsOiBbICdyZWFjdCcsICdyZWFjdC9qc3gtcnVudGltZScsICdyZWFjdC1kb20nIF0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZm9ybWF0OiAnaWlmZScsXG4gICAgICAgIG5hbWU6ICdMdW5hQXN0cm9IRE1vZHVsZScsXG4gICAgICAgIGdsb2JhbHM6IHtcbiAgICAgICAgICByZWFjdDogICAgICAgICAgICAgICAnUmVhY3QnLFxuICAgICAgICAgICdyZWFjdC9qc3gtcnVudGltZSc6ICdSZWFjdEpTWFJ1bnRpbWUnLFxuICAgICAgICAgICdyZWFjdC1kb20nOiAgICAgICAgICdSZWFjdERPTScsXG4gICAgICAgIH0sXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL2x1bmEtYXN0cm9oZC1tb2R1bGUuanMnLFxuICAgICAgICBjaHVua0ZpbGVOYW1lczogICdhc3NldHMvW25hbWVdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICAnYXNzZXRzL1tuYW1lXS5bZXh0XScsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59ICk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1mLFNBQVMsb0JBQW9CO0FBQ2hoQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFXeEIsSUFBTSw0QkFBNEI7QUFBQSxFQUNoQyxNQUFNO0FBQUEsRUFDTixVQUFXLElBQUs7QUFDZCxRQUFLLE9BQU8sZ0JBQWtCLFFBQU87QUFBQSxFQUN2QztBQUFBLEVBQ0EsS0FBTSxJQUFLO0FBQ1QsUUFBSyxPQUFPLDJCQUE0QjtBQUN0QyxhQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTVQ7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFPLHNCQUFRLGFBQWM7QUFBQSxFQUMzQixTQUFTLENBQUUsTUFBTSxHQUFHLFlBQVksR0FBRyx5QkFBMEI7QUFBQSxFQUM3RCxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsTUFDUCxVQUFVLENBQUUsU0FBUyxxQkFBcUIsV0FBWTtBQUFBLE1BQ3RELFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNQLE9BQXFCO0FBQUEsVUFDckIscUJBQXFCO0FBQUEsVUFDckIsYUFBcUI7QUFBQSxRQUN2QjtBQUFBLFFBQ0EsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWlCO0FBQUEsUUFDakIsZ0JBQWlCO0FBQUEsTUFDbkI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
