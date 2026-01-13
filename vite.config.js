import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/michonne_chatbot/',
  server: {
    port: 5173,
  },
});
