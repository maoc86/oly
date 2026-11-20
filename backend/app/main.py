import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.config import settings
from app.traffic import traffic_cleanup_loop, traffic_middleware
from app.routes import (
    auth,
    admin_categories,
    admin_email_templates,
    admin_finance,
    admin_payments,
    admin_products,
    admin_traffic,
    admin_users,
    backup,
    coupons,
    customers,
    dashboard,
    favorites,
    hero_slides,
    orders,
    payment_methods,
    pos,
    products,
    settings_exchange,
    shipping,
    site_settings,
    uploads,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    cleanup_task = asyncio.create_task(traffic_cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()


from app.middleware.maintenance import MaintenanceMiddleware

app = FastAPI(title="Oly Official API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(MaintenanceMiddleware)
app.middleware("http")(traffic_middleware)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


# Público
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(products.categories_router)
app.include_router(favorites.router)
app.include_router(orders.router)
app.include_router(coupons.router)
app.include_router(payment_methods.router)
app.include_router(shipping.router)
app.include_router(settings_exchange.router)
app.include_router(hero_slides.router)
app.include_router(site_settings.router)
app.include_router(uploads.router)

# Admin
app.include_router(dashboard.router)
app.include_router(admin_products.router)
app.include_router(admin_products.inventory_router)
app.include_router(admin_categories.router)
app.include_router(admin_payments.router)
app.include_router(admin_users.router)
app.include_router(admin_users.catalog_router)
app.include_router(admin_finance.router)
app.include_router(admin_email_templates.router)
app.include_router(admin_traffic.router)
app.include_router(customers.router)
app.include_router(coupons.admin_router)
app.include_router(shipping.admin_router)
app.include_router(backup.router)

# POS
app.include_router(pos.router)


# Servir imágenes subidas
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
