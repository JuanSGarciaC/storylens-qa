# Un solo servicio: FastAPI sirve la API y la interfaz desde el mismo origen, así la cookie de
# sesión del dueño funciona sin CORS ni proxy (local con docker compose y en Render).
FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# Sin VITE_API_BASE_URL: el navegador llama a /api/v1 en el mismo origen.
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

# Instalación editable: las migraciones de Alembic se buscan junto al código fuente.
# El extra postgres permite usar una base PostgreSQL gratuita en la nube (Neon).
COPY backend/pyproject.toml backend/alembic.ini ./
COPY backend/app ./app
COPY backend/migrations ./migrations
RUN pip install --no-cache-dir -e ".[postgres]"
COPY --from=frontend /app/dist ./static

# Datos que deben sobrevivir a un reinicio en local (SQLite): montar un volumen en /data.
ENV DATABASE_URL=sqlite:////data/storylens.db \
    STATIC_DIR=/app/static \
    PORT=8000
RUN mkdir -p /data && useradd --create-home app && chown -R app /app /data
USER app
VOLUME ["/data"]
EXPOSE 8000

# Los secretos (GEMINI_API_KEY, OWNER_*, SESSION_SECRET) llegan por variables de entorno: nunca en la imagen.
# --proxy-headers: detrás del proxy del host, la IP real del cliente llega en X-Forwarded-For.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
