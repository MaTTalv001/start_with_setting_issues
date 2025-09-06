#!/bin/bash
echo "Building frontend..."
cd frontend
npm run build

echo "Starting production server..."
cd ../backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000