# 開発中仕様メモ

## アプリケーション概要

### 目的

要件定義書（Markdown 形式）から AI を使用して GitHub イシューを自動生成し、選択したリポジトリに直接作成できる Web アプリケーション。

### 主な機能

1. **GitHub OAuth 認証** - ユーザーの GitHub アカウントでログイン
2. **リポジトリ選択** - ユーザーが所有するリポジトリをプルダウンで選択
3. **要件定義入力** - Markdown 形式でプロジェクト要件を記述
4. **AI イシュー生成** - OpenAI GPT-4o-mini を使用してイシューを自動生成
5. **イシュー管理** - 生成されたイシューの閲覧、編集、複数選択
6. **イシュー作成** - 選択したイシューを GitHub リポジトリに一括作成

## 技術スタック

### フロントエンド

- **React 18** + **TypeScript**
- **Vite** (ビルドツール)
- **TailwindCSS** + **DaisyUI** (スタイリング)
- **モーダル機能** (イシュープレビュー・編集)

### バックエンド

- **FastAPI** (Python Web フレームワーク)
- **python-jose** (JWT 認証)
- **httpx** (HTTP クライアント)
- **OpenAI API** (GPT-4o-mini)

### インフラ・デプロイ

- **Railway** (PaaS ホスティング)
- **Docker** (コンテナ化)

## プロジェクト構造

```
project/
├── frontend/                   # Reactアプリケーション
│   ├── src/
│   │   ├── App.tsx            # メインアプリケーション
│   │   ├── main.tsx           # エントリポイント
│   │   └── index.css          # TailwindCSS設定
│   ├── package.json
│   ├── vite.config.ts         # Vite設定
│   ├── tailwind.config.cjs    # TailwindCSS設定
│   └── postcss.config.cjs     # PostCSS設定
├── backend/                    # FastAPIアプリケーション
│   ├── main.py               # メインアプリケーション
│   ├── auth.py               # GitHub認証機能
│   ├── llm_service.py        # OpenAI API連携
│   └── requirements.txt      # Python依存関係
├── Dockerfile                # Docker設定
└── .env                      # 環境変数（本番では使用しない）
```

## 重要なコードファイル詳細

### frontend/src/App.tsx

```typescript
// メインのReactコンポーネント
// 主な機能：
// - GitHub OAuth ログイン
// - リポジトリ選択UI
// - マークダウン入力フォーム
// - AI生成イシューの表示・編集
// - 複数選択でのイシュー作成

// 重要な状態管理：
const [user, setUser] = useState<User | null>(null);
const [repositories, setRepositories] = useState<Repository[]>([]);
const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
const [generatedIssues, setGeneratedIssues] = useState<GeneratedIssue[]>([]);
const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());

// 主要な関数：
// - handleGithubLogin(): GitHub認証開始
// - generateIssues(): OpenAI APIでイシュー生成
// - createSelectedIssues(): 選択イシューの一括作成
```

### backend/main.py

```python
# FastAPIメインアプリケーション
# 主要エンドポイント：

@app.get("/api/config")                    # フロントエンド用設定取得
@app.get("/api/auth/callback")             # GitHub OAuth コールバック
@app.get("/api/auth/me")                   # 現在ユーザー情報取得
@app.post("/api/auth/logout")              # ログアウト
@app.get("/api/github/repositories")       # ユーザーリポジトリ一覧
@app.post("/api/github/create-issue")      # GitHubイシュー作成
@app.post("/api/llm/generate-issues")      # AI イシュー生成
@app.get("/api/llm/sample-markdown")       # サンプルマークダウン取得

# 重要な設定：
IS_PRODUCTION = os.getenv("RAILWAY_ENVIRONMENT") == "production"
```

### backend/auth.py

```python
# GitHub OAuth認証とJWT管理
# 主要機能：
# - GitHubアクセストークン取得
# - ユーザー情報取得
# - リポジトリ一覧取得
# - イシュー作成
# - JWT トークン生成・検証

# セキュリティ設定：
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24時間
```

### backend/llm_service.py

```python
# OpenAI API連携とイシュー生成
# 重要な機能：
# - JSON mode使用でレスポンス安定化
# - 手動バリデーションによる堅牢性
# - フォールバック機能

# プロンプト設計：
ISSUE_GENERATION_PROMPT = """
あなたは経験豊富なソフトウェア開発のプロジェクトマネージャーです。
要件定義マークダウンを分析してGitHubイシューを生成してください。
"""

# OpenAI API呼び出し：
response = client.chat.completions.create(
    model="gpt-4o-mini",
    response_format={"type": "json_object"}  # JSON mode
)
```

## 環境変数設定

### 必須環境変数

```bash
# GitHub OAuth (GitHub Developer settingsで取得)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT暗号化キー (ランダムな文字列)
SECRET_KEY=your_random_secret_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Railway用
RAILWAY_ENVIRONMENT=production
PORT=8000
```

### GitHub OAuth 設定

GitHub Developer settings (https://github.com/settings/developers) で以下を設定：

- **Application name**: GitHub Issue Maker
- **Homepage URL**: `https://your-app-name.up.railway.app`
- **Authorization callback URL**: `https://your-app-name.up.railway.app/api/auth/callback`

## デプロイ設定

### Dockerfile

```dockerfile
# フロントエンドビルド
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/ ./frontend/
COPY backend/ ./backend/
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# バックエンド
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/backend/static ./static/
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Railway デプロイ手順

1. **アカウント作成**: railway.app で GitHub アカウント連携
2. **プロジェクト作成**: "Deploy from GitHub repo" でリポジトリ選択
3. **環境変数設定**: Variables タブで上記環境変数を設定
4. **ドメイン生成**: Settings > Domains で Generate Domain (Port: 8000)
5. **自動デプロイ**: GitHub プッシュで自動的に再デプロイ

## 開発環境構築

### 初回セットアップ

```bash
# リポジトリクローン
git clone <repository-url>
cd github-issue-maker

# フロントエンド
cd frontend
npm install

# バックエンド
cd ../backend
python -m venv venv
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate   # Windows
pip install -r requirements.txt

# 環境変数設定
cp .env.example .env
# .envファイルを編集
```

### 開発サーバー起動

```bash
# バックエンド (ターミナル1)
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# フロントエンド (ターミナル2)
cd frontend
npm run dev
```

### 本番ビルド

```bash
cd frontend
npm run build  # ../backend/static にビルド

cd ../backend
uvicorn main:app --port 8000  # 本番モード
```

## 主要な依存関係

### Frontend (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.13",
    "tailwindcss": "^3.4.0",
    "daisyui": "^4.12.0",
    "vite": "^4.1.0"
  }
}
```

### Backend (requirements.txt)

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
httpx==0.25.2
python-dotenv==1.0.0
openai==1.6.1
```

## アーキテクチャフロー

1. **認証フロー**:

   - ユーザーが GitHub ログインボタンクリック
   - GitHub OAuth 画面にリダイレクト
   - 認証後、コールバックで JWT トークン生成
   - クッキーにトークン保存

2. **イシュー生成フロー**:

   - リポジトリ選択
   - マークダウン入力
   - OpenAI API でイシュー生成 (JSON mode)
   - 生成結果をバリデーション
   - フロントエンドで表示・編集

3. **イシュー作成フロー**:
   - 複数イシューを選択
   - GitHub API 並列呼び出し
   - 作成結果を表示

## トラブルシューティング

### 詰まりポイント

1. **GitHub 認証エラー**:

   - OAuth 設定のコールバック URL 確認
   - 環境変数の設定確認

2. **OpenAI API エラー**:

   - API キーの有効性確認
   - リクエスト制限の確認

3. **Railway デプロイエラー**:
   - 環境変数設定確認
   - ビルドログの確認
   - ポート設定確認 (8000)

### デバッグ用エンドポイント

- `/api/health` - サーバー稼働確認
- `/api/config` - 設定情報取得
- ブラウザ開発者ツールでネットワーク・コンソール確認

## セキュリティ考慮事項

- JWT トークンは HttpOnly クッキーで管理
- GitHub アクセストークンは JWT 内に暗号化保存
- CORS 設定で適切なオリジン制限
- OpenAI API キーはサーバーサイドでのみ使用
- 本番環境では HTTPS 強制

## 今後の拡張可能性

- ファイルアップロード機能
- プロジェクト管理機能連携
- 複数の LLM モデル対応
- イシューテンプレート管理
- チーム機能
- 生成履歴管理
