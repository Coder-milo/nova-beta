# Etapa 1: Dependencias y Compilación
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar servidor SSR de Astro
ENV NODE_ENV=production
RUN npm run build

# Etapa 2: Entorno de Ejecución Ligero
FROM node:20-alpine AS runner

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
