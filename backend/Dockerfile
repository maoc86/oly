# ---- Base image ----
FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Cliente MySQL (mysqldump) para el endpoint de backup.
RUN apt-get update -qq && apt-get install -y -qq default-mysql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencias primero para cachear la capa.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código de la aplicación y migraciones.
COPY app ./app
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Directorio de imágenes subidas y comprobantes (se montan como volumen en producción).
RUN mkdir -p /app/app/uploads /app/app/receipts

# Usuario sin privilegios (evita correr como root).
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# El entrypoint aplica migraciones antes de arrancar uvicorn.
ENTRYPOINT ["./docker-entrypoint.sh"]

# --proxy-headers + --forwarded-allow-ips=*: el backend va detrás de Caddy
# (reverse proxy), que define el host/esquema reales. Esto hace que las URLs
# de las imágenes subidas salgan con el dominio y el protocolo correctos.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
