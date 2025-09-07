# Node.jsでフロントエンドをビルド
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Pythonでバックエンドを実行
FROM python:3.11-slim
WORKDIR /app

# 依存関係をインストール
COPY backend/requirements.txt ./backend/
RUN pip install -r backend/requirements.txt

# アプリケーションをコピー
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./backend/static/

# ポートを公開
EXPOSE 8000

# 起動コマンド
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]