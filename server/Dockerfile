FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    fontconfig \
    fonts-liberation \
    fonts-roboto \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY . .

EXPOSE 8000

# Single worker: Socket.IO room membership (_uid_sids) and the draft-cleanup
# loop are in-process state, not shared across workers.
CMD uv run uvicorn main:socket_app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
