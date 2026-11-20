# ---- Dependencias (capa cacheable) ----
FROM node:20.19.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:20.19.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_API_URL se inyecta en el build (es una variable pública).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# INTERNAL_API_URL: URL interna del backend para rewrites/SSR en el contenedor.
ARG INTERNAL_API_URL=http://localhost:8000
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
RUN npm run build

# ---- Runner (standalone: solo dependencias de producción) ----
FROM node:20.19.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Salida standalone de Next.js: servidor mínimo + node_modules de producción.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Directorio de caché del optimizador de imágenes para usuario no-root.
RUN mkdir -p /app/.next/cache/images && chown -R node:node /app

# Usuario sin privilegios (el usuario `node` ya existe en la imagen base).
USER node

EXPOSE 3000

CMD ["node", "server.js"]
