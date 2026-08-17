import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages では https://<user>.github.io/todoApp/ で配信されるため base を揃える。
// dev / preview でも同じ base を使い、本番だけパスが違う状態を作らない。
// リポジトリ名を変えたらここも変えること。
export default defineConfig({
  base: '/todoApp/',
  plugins: [react()],
})
