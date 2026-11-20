# Oly Official — Plan de proyecto

Tienda virtual de ropa deportiva (mayoría mujer) para **La Mara Oly** — `olyofficial.com`.
Sistema completo: tienda pública estilizada + panel administrativo (inventario, finanzas,
POS, tasas de cambio).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS 4) |
| Backend | Python FastAPI (3.11) |
| Base de datos | MySQL + SQLAlchemy ORM + Alembic |
| Autenticación | JWT + permisos por rol |
| Pagos | Transferencia / pago móvil con comprobante y confirmación manual del admin |
| Moneda | USD + VES con tasa manual (o DolarApi) configurada por el admin |

## Origen

- **Base (backoffice):** `tuboletoexpress` (ticketve.com) — aporta auth/permisos, finanzas
  (ingresos/egresos, proveedores, cuentas por pagar, pagos), tasas de cambio, POS con turnos
  de caja, admin, tráfico, emails, slides.
- **Dominio e-commerce:** `boomstoreve` — aporta Producto (precios detal/mayor/oferta),
  movimientos de inventario, ventas físicas, clientes, favoritos.

## Decisiones de producto (confirmadas)

- Variantes de producto: **talla + color** (stock por combinación, SKU por variante).
- Pagos online: **transferencia/pago móvil + comprobante**, confirmación manual.
- Solo **web** responsive (se elimina la app Expo).
- **Tienda única** (se elimina el concepto de organizador/multi-vendedor).
- Roles: `admin`, `vendedor` (POS), `cliente`.

## Modelo de dominio (nuevo)

Reemplaza el dominio de "eventos/boletos" por el de "productos de ropa":

```
users, user_roles, user_permissions   (reutilizado, sin rol organizer)
categories                            (reutilizado, adaptado a moda)
products          → SKU, nombre, descripción, precios (detal/mayor/oferta),
                     estado, marca, destacado, etiquetas
product_variants  → talla + color, SKU, precio override, stock, stock mínimo
product_images     → galería por producto (o JSON en products)
inventory_movements → entry/exit/adjustment/sale_web/sale_pos/return
                      (stock anterior/nuevo, usuario, referencia, notas)
orders, order_items → adaptado a productos/variantes (subtotal, descuento,
                      impuesto, envío, total)
customers          → datos del cliente de mostrador/POS
favorites          → productos favoritos del cliente
carts / checkout   → carrito (puede ser estado cliente o servidor)
payment_methods    (reutilizado)
finance_entries    (reutilizado) — ingreso automático por venta + manuales
vendors, payables, payouts (reutilizado)
coupons             (reutilizado, aplicado a productos)
exchange rate       (reutilizado: manual + DolarApi)
settings / site_config (reutilizado, re-etiquetado a Oly)
email_templates, hero_slides, request_logs (reutilizado)
cash_sessions       (reutilizado, turnos de caja del POS)
```

## Estructura de directorios

```
olyofficial/
├── backend/          # FastAPI (puerto 8000)
│   └── app/
│       ├── models/       # dominio (se reescribe __init__.py)
│       ├── schemas/      # Pydantic
│       ├── routes/       # productos, órdenes, POS, finanzas, tasas, admin...
│       ├── services/     # lógica de venta/inventario
│       └── utils/        # auth, render, uploads
├── frontend/         # Next.js (puerto 3000)
│   └── src/
│       ├── app/(public)/   # tienda pública (home, catálogo, detalle, carrito, checkout)
│       ├── app/admin/      # panel (productos, inventario, finanzas, tasas, ventas)
│       └── app/pos/        # punto de venta (venta en tienda + caja)
├── deploy/           # docker + caddy + backups
└── PLAN.md
```

## Roadmap

- [x] **Fase 0 — Base:** copiar ticketve → `olyofficial`, limpiar, git init.
- [x] **Fase 1 — Dominio backend:** reescribir modelos (productos/variantes/inventario),
      quitar eventos/boletos/organizador, migración inicial nueva.
- [x] **Fase 2 — API:** rutas de catálogo, carrito, checkout, admin productos/inventario,
      POS, finanzas, tasas, cupones, envíos, clientes.
- [x] **Fase 3 — Tienda pública:** home, catálogo con filtros, detalle (talla/color),
      carrito, checkout (transferencia + comprobante), cuenta/mis pedidos, favoritos.
- [x] **Fase 4 — Panel admin + POS:** dashboard, productos, inventario, finanzas, tasas,
      ventas/pedidos, POS con caja.
- [ ] **Fase 5 — Pulido:** branding deportivo (colores/imágenes reales), contenido legal
      (términos), responsive final, SEO/OG, mejoras de UX.

## Pendientes conocidos

- Redactar el contenido de Términos y Condiciones para la tienda (hoy es el texto de eventos).
- Pestaña "Cuentas por pagar" de Finanzas: quitar la opción "organizador" que ya no aplica.
- Probar el stack completo en Docker (frontend + backend + db) y el despliegue con Caddy.

## Referencias

- `backend/README.md` y `frontend/README.md` (del proyecto base) documentan instalación local.
- `deploy/` conserva el runbook de Docker + Caddy para producción.
