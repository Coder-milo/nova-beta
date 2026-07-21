/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },

  // Reescritura de rutas: el frontend llama a /api/* y Next.js
  // lo redirige al backend en NEXT_PUBLIC_API_URL (solo en desarrollo).
  // Esto evita problemas de CORS cuando ambos corren en localhost.
  // En producción usa la variable directamente desde el cliente.
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
