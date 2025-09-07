# フロントエンドビルド
FROM node:18-alpine AS frontend-build
WORKDIR /app

# プロジェクト全体をコピー
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# フロントエンドディレクトリに移動してビルド
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# バックエンド
FROM python:3.11-slim
WORKDIR /app

# 依存関係をインストール
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

# バックエンドのコードをコピー
COPY backend/ ./

# フロントエンドのビルド結果をコピー
COPY --from=frontend-build /app/backend/static ./static/

# ポートを公開
EXPOSE 8000

# 起動コマンド
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]