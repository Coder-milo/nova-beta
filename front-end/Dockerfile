# Etapa 1: Dependencias y Compilación
FROM node:22-alpine AS builder

WORKDIR /app

# Habilitar corepack para pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar manifiestos de dependencias
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Compilar servidor SSR de Astro
ENV NODE_ENV=production
RUN pnpm run build

# Etapa 2: Entorno de Ejecución Ligero
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copiar artefactos compilados y dependencias necesarias
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Usuario no root por seguridad
RUN addgroup -S novacrm && adduser -S novacrm -G novacrm
USER novacrm

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs"]
