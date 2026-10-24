FROM python:3.12-slim

WORKDIR /app

# Instalación editable: las migraciones de Alembic se buscan junto al código fuente.
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations
RUN pip install --no-cache-dir -e .

# Datos que deben sobrevivir a un reinicio (base SQLite y evidencias): montar un volumen en /data.
ENV DATABASE_URL=sqlite:////data/storylens.db \
    EVIDENCE_DIR=/data/evidence \
    PORT=8000
RUN mkdir -p /data && useradd --create-home app && chown -R app /app /data
USER app
VOLUME ["/data"]
EXPOSE 8000

# Los secretos (GEMINI_API_KEY, OWNER_*, SESSION_SECRET) llegan por variables de entorno: nunca en la imagen.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
