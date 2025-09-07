# フロントエンドビルド
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/ ./frontend/
COPY backend/ ./backend/
RUN cd frontend && npm ci && npm run build

# バックエンド
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/backend/static ./static/

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]