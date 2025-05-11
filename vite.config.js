import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    base: '/',
    cors: true,
    host: true,  // 외부 접속 허용
    port: 3000,  // 실행 포트
    allowedHosts: ['tgnco.world', 'www.tgnco.world'], // 허용된 도메인 추가
    hmr: {
      host: 'tgnco.world',  // WebSocket 통신을 위한 호스트 지정
      protocol: 'ws',  // HTTPS에서 WebSocket은 wss 사용
    }
  }
})
