#!/bin/bash
echo "Starting development servers..."

# フロントエンド開発サーバー起動
cd frontend
npm run dev &
FRONTEND_PID=$!

# バックエンド開発サーバー起動
cd ../backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Frontend PID: $FRONTEND_PID"
echo "Backend PID: $BACKEND_PID"

# Ctrl+Cで両方のプロセスを終了
trap "kill $FRONTEND_PID $BACKEND_PID" EXIT

wait