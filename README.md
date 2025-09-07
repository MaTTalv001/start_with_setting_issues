# イシューから定めよ

要件定義書から AI を活用して GitHub イシューを自動生成する Web アプリケーション

## 📋 目次

- [アプリケーション概要](#アプリケーション概要)
- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [プロジェクト構成](#プロジェクト構成)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [環境変数設定](#環境変数設定)
- [使い方](#使い方)
- [デプロイ環境](#デプロイ環境)
- [API 仕様](#api仕様)
- [ライセンス](#ライセンス)

## 🎯 アプリケーション概要

「イシューから定めよ」は、プロジェクトの要件定義書を入力するだけで、AI が自動的に GitHub イシューに分解・生成するツールです。

### 🎨 デザインコンセプト

書籍「イシューからはじめよ」へのリスペクトを込めたデザインを採用しています。その背景もあって、あくまで RUNTEQ 内の閉じたコンテンツとして紹介しています。

### 🚀 解決する課題

- **要件定義からタスク分解の自動化**: 手動でのイシュー作成作業を大幅に短縮
- **適切な粒度でのタスク分解**: AI（GPT-5）がエンジニア視点で実装可能な単位に分解
- **即座のプロジェクト開始**: 生成されたイシューで開発チームが即座に作業開始可能

## ✨ 主な機能

### 🔐 認証機能

- **GitHub OAuth 認証**: GitHub アカウントでのワンクリックログイン
- **リポジトリアクセス**: ユーザーの権限に応じたリポジトリ一覧表示

### 📝 要件定義入力

- **手動入力**: Markdown エディタでの直接入力
- **ファイルアップロード**: `.md`, `.txt`, `.markdown`ファイルの対応（最大 5MB）
- **ドラッグ&ドロップ**: 直感的なファイル操作
- **サンプル要件**: 学習用のサンプル要件定義を提供

### 🤖 AI イシュー生成

- **GPT-5 活用**: 最新の OpenAI GPT-5-chat-latest モデル使用
- **エンジニア視点**: 実装者目線での適切な粒度でタスク分解
- **技術領域別分類**: フロントエンド、バックエンド、インフラ、テストなど
- **依存関係考慮**: タスク間の前後関係や並行実行可能性を分析

### 🎛️ イシュー管理

- **プレビュー機能**: 生成されたイシューの詳細確認
- **編集機能**: タイトル、本文、ラベル、優先度の調整
- **複数選択**: 必要なイシューのみを選択して作成
- **一括作成**: 選択したイシューを GitHub に一括登録

### 🎨 ユーザーインターフェース

- **段階的ガイド**: ① リポジトリ選択 → ② 要件入力 → ③ イシュー選択・作成
- **レスポンシブデザイン**: デスクトップ・モバイル対応
- **リアルタイムフィードバック**: 処理状況の可視化

## 🛠️ 技術スタック

### フロントエンド

- **React 18** + **TypeScript**: モダンな UI 開発
- **Vite**: 高速なビルドツール
- **TailwindCSS** + **DaisyUI**: ユーティリティファースト CSS

### バックエンド

- **FastAPI**: 高性能 Python Web フレームワーク

### AI・外部 API

- **OpenAI API**: GPT-5-chat-latest モデル
- **GitHub API**: OAuth 認証・リポジトリ操作・イシュー作成

### インフラ・デプロイ

- **Railway**: PaaS ホスティング
- **Docker**: コンテナ化
- **GitHub OAuth Apps**: 認証基盤

## 📁 プロジェクト構成

```
issue-setting/
├── frontend/                   # Reactアプリケーション
│   ├── src/
│   │   ├── App.tsx            # メインコンポーネント
│   │   ├── main.tsx           # エントリポイント
│   │   └── index.css          # スタイル設定
│   ├── package.json
│   ├── vite.config.ts         # Vite設定
│   ├── tailwind.config.cjs    # TailwindCSS設定
│   └── postcss.config.cjs     # PostCSS設定
├── backend/                    # FastAPIアプリケーション
│   ├── main.py               # メインアプリケーション
│   ├── auth.py               # GitHub認証・JWT管理
│   ├── llm_service.py        # OpenAI API連携
│   └── requirements.txt      # Python依存関係
├── Dockerfile                # Docker設定
├── .env.example              # 環境変数テンプレート
└── README.md                 # このファイル
```

## 🚀 開発環境のセットアップ

### 前提条件

- **Node.js**: v18 以上
- **Python**: v3.11 以上
- **Git**: 最新版

### 1. リポジトリのクローン

```bash
git clone https://github.com/MaTTalv001/start_with_setting_issues.git
cd start_with_setting_issues
```

### 2. フロントエンドのセットアップ

```bash
cd frontend
npm install
```

### 3. バックエンドのセットアップ

```bash
cd backend
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 4. 環境変数の設定

```bash
# ルートディレクトリで .env ファイルを作成
cp .env.example .env
```

`.env` ファイルを編集して必要な環境変数を設定してください。

### 5. 開発サーバーの起動

**バックエンド (ターミナル 1)**

```bash
cd backend
source venv/bin/activate  # 仮想環境をアクティベート
uvicorn main:app --reload --port 8000
```

**フロントエンド (ターミナル 2)**

```bash
cd frontend
npm run dev
```

### 6. アクセス

- フロントエンド: http://localhost:5173
- バックエンド API: http://localhost:8000
- API 仕様書: http://localhost:8000/docs

## 🔧 環境変数設定

### 必須環境変数

```bash
# GitHub OAuth設定
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT暗号化キー
SECRET_KEY=your_random_secret_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Railway用（本番環境）
RAILWAY_ENVIRONMENT=production
PORT=8000
```

### GitHub OAuth App の設定

1. GitHub Developer Settings (https://github.com/settings/developers) にアクセス
2. "New OAuth App" をクリック
3. 以下の情報を入力：
   - **Application name**: Issue Setting
   - **Homepage URL**: `https://your-app-name.up.railway.app` (本番) / `http://localhost:5173` (開発)
   - **Authorization callback URL**: `https://your-app-name.up.railway.app/api/auth/callback` (本番) / `http://localhost:8000/api/auth/callback` (開発)

### OpenAI API キーの取得

1. OpenAI Platform (https://platform.openai.com) にアクセス
2. API Keys セクションで新しいキーを生成
3. 生成されたキーを `OPENAI_API_KEY` に設定

## 📖 使い方

### 基本的な使用手順

1. **GitHub ログイン**

   - 「GitHub ログイン」ボタンをクリック
   - GitHub の認証画面で権限を許可

2. **リポジトリ選択**

   - アクセス可能なリポジトリが一覧表示
   - イシューを作成したいリポジトリを選択

3. **要件定義入力**

   - テキストエリアに直接入力、または
   - ファイルをドラッグ&ドロップ/選択してアップロード
   - サンプル要件を読み込んで試すことも可能

4. **イシュー生成**

   - 「イシューを生成」ボタンをクリック
   - AI が要件を分析してタスクに分解

5. **イシュー編集・選択**

   - 生成されたイシューをプレビュー
   - 必要に応じてタイトル、本文、ラベル、優先度を編集
   - 作成したいイシューにチェック

6. **GitHub 登録**
   - 「選択したイシューを作成」ボタンをクリック
   - 選択したイシューが GitHub リポジトリに一括作成

### ファイルアップロード仕様

- **対応形式**: `.md`, `.txt`, `.markdown`
- **最大サイズ**: 5MB
- **文字エンコーディング**: UTF-8

## 🌐 デプロイ環境

### Railway デプロイ手順

1. **Railway アカウント作成**

   - railway.app で GitHub アカウント連携

2. **プロジェクト作成**

   - "Deploy from GitHub repo" でリポジトリ選択
   - 自動的に Dockerfile を検出してビルド

3. **環境変数設定**

   - Variables タブで上記の環境変数を設定

4. **ドメイン生成**

   - Settings > Domains で "Generate Domain"
   - Port: 8000 を指定

5. **自動デプロイ**
   - GitHub へのプッシュで自動的に再デプロイ

### 本番用 Dockerfile

```dockerfile
# フロントエンドビルド
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm ci && npm run build

# バックエンド
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static/
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📚 API 仕様

### 主要エンドポイント

#### 認証関連

- `GET /api/auth/callback` - GitHub OAuth コールバック
- `GET /api/auth/me` - 現在ユーザー情報取得
- `POST /api/auth/logout` - ログアウト

#### GitHub 連携

- `GET /api/github/repositories` - ユーザーリポジトリ一覧
- `POST /api/github/create-issue` - GitHub イシュー作成

#### AI 機能

- `POST /api/llm/generate-issues` - AI イシュー生成
- `GET /api/llm/sample-markdown` - サンプルマークダウン取得

#### システム

- `GET /api/config` - フロントエンド用設定
- `GET /api/health` - ヘルスチェック

詳細な API 仕様は開発サーバー起動後に `/docs` で確認できます。

## 🔍 トラブルシューティング

### よくある問題と解決策

**GitHub 認証エラー**

- OAuth 設定のコールバック URL 確認
- 環境変数 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` の設定確認

**OpenAI API エラー**

- API キーの有効性確認
- 利用制限・残高の確認

**Railway デプロイエラー**

- 環境変数設定確認
- ビルドログの確認
- ポート設定確認 (8000)

## 🙏 リスペクト

- 「イシューからはじめよ」（安宅和人著）
- RUNTEQ コミュニティ
