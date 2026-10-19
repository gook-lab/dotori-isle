import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // three 는 트리 셰이킹 후에도 700KB 남짓이라 경고 기준을 그 위로 둔다.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // 라이브러리는 게임 코드보다 덜 바뀌므로 따로 묶어 브라우저 캐시를 오래 살린다.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 2 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|@react-three|zustand|its-fine|suspend-react)[\\/]/, priority: 1 },
            // 게임 규칙(core)은 화면 코드(scene·ui)와 따로 묶어 index 한 덩어리를 줄인다. 둘 다 시작할 때 바로 읽는 정적 묶음이라 지연 로딩이 생기지 않는다.
            { name: 'core', test: /src[\\/]core[\\/]/, priority: 0, minSize: 0 },
          ],
        },
      },
    },
  },
  test: { environment: 'node' },
})
