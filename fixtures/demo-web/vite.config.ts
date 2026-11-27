import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mockApi } from './mock/api';

export default defineConfig({
  plugins: [react(), mockApi()],
  // demo-lib 通过 link 引入，React 只保留一份
  resolve: { dedupe: ['react', 'react-dom'] },
});
