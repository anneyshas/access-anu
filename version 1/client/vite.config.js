import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
//
// Testing live GPS on a phone: phones only share location with HTTPS pages.
//   npm i -D @vitejs/plugin-basic-ssl      (once)
//   HTTPS=1 npm run dev -- --host          then open https://<your-PC-IP>:5173 on the phone
// With VITE_API_BASE_URL=/api the phone reaches the API through the proxy below.
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const plugins = [react(), tailwindcss()]
  if (process.env.HTTPS) {
    const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl')
    plugins.push(basicSsl())
  }
  return {
    plugins,
    server: {
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:5000' },
      allowedHosts: true
    },
  }
})