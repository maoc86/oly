# Oly Official 🏋️‍♀️

Tienda virtual de ropa deportiva (mayoría mujer) para **La Mara Oly** — `olyofficial.com`.
Incluye tienda pública estilizada, panel administrativo (productos, inventario,
finanzas, tasas de cambio) y punto de venta (POS) para la tienda física.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS 4) |
| Backend | Python FastAPI (3.11) |
| Base de datos | MySQL 8 + SQLAlchemy + Alembic |
| Autenticación | JWT + permisos por rol (`admin`, `vendedor`, `cliente`) |
| Pagos | Transferencia / pago móvil con comprobante y confirmación manual |
| Moneda | USD + VES con tasa manual (o DolarApi) |

## Estructura

```
olyofficial/
├── backend/          # FastAPI (puerto 8000)
├── frontend/         # Next.js (puerto 3000)
├── deploy/           # Scripts de despliegue (VPS, backups)
├── docker-compose.yml + override
├── Caddyfile         # HTTPS automático en producción
└── PLAN.md           # Plan y roadmap del proyecto
```

## Puesta en marcha local (Docker)

```bash
# 1. Copiar variables de entorno
cp .env.example .env   # ajusta secretos

# 2. Levantar base de datos + backend + frontend
docker compose up -d db backend frontend

# 3. Crear el admin y datos iniciales (solo la primera vez)
docker compose exec backend python -m app.seed
#   con variables: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 4. Abrir
#   Frontend: http://localhost:3000
#   API docs: http://localhost:8000/docs
```

> El override (`docker-compose.override.yml`) publica los puertos y construye las
> imágenes localmente. En producción se usan imágenes de un registro (`docker compose up -d`
> con el `Caddyfile` para HTTPS).

## Puesta en marcha local (sin Docker)

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  (source venv/bin/activate en Linux/Mac)
pip install -r requirements.txt
cp .env.example .env          # ajusta DATABASE_URL y SECRET_KEY
alembic upgrade head
SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... python -m app.seed
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## Producción

Ver [`deploy/`](./deploy) y el runbook de despliegue para VPS con Docker + Caddy
(HTTPS automático), backups y actualizaciones. Las variables de producción van en
`.env.production.example`.

## Roles

- **admin** — panel completo: productos, inventario, finanzas, tasas, ventas, usuarios.
- **vendedor** — solo el POS (venta presencial y caja).
- **cliente** — compra en la tienda online, favoritos, historial de pedidos.

## Estado

El backend (API) está funcional de punta a punta. El frontend (tienda pública,
panel admin y POS) está en desarrollo. Ver [`PLAN.md`](./PLAN.md) para el detalle
del roadmap.
