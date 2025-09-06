# フロントエンドビルド
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# バックエンド
FROM python:3.11-slim
WORKDIR /app

# 依存関係インストール
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

# アプリケーションコピー
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static

# ポート公開
EXPOSE 8000

# 起動コマンド
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]