import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Include React plugin if using React

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Output directory for build files
    assetsDir: 'assets', // Directory for static assets like JS and CSS
    rollupOptions: {
      output: {
        entryFileNames: 'index-[hash].js', // Generates hashed JS filenames for cache-busting
      },
    },
  },
  server: {
    open: true, // Automatically opens the app in the browser during development
  },
});
