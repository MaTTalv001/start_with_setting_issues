import os
from dotenv import load_dotenv
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta
from pydantic import BaseModel

# 既存のインポート
from auth import (
    exchange_code_for_token, 
    get_github_user, 
    create_access_token, 
    verify_token,
    get_user_repositories,
    create_github_issue,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from llm_service import generate_issues_from_markdown, SAMPLE_MARKDOWN

load_dotenv()

app = FastAPI(title="GitHub Issue Maker")

# Railway環境判定
IS_PRODUCTION = os.getenv("RAILWAY_ENVIRONMENT") == "production"

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイル配信
static_dir = Path(__file__).parent / "static"  # Pathオブジェクトとして定義
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")
    print(f"Static files mounted from: {static_dir}")
else:
    print(f"Static directory not found: {static_dir}")



class CreateIssueRequest(BaseModel):
    repository: str
    title: str
    body: str
    labels: list[str] = []

class GenerateIssuesRequest(BaseModel):
    markdown_content: str = ""

@app.get("/api/config")
async def get_config():
    """フロントエンド用設定"""
    return {
        "github_client_id": os.getenv("GITHUB_CLIENT_ID")
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}

# 認証コールバックでのクッキー設定を修正
@app.get("/api/auth/callback")
async def auth_callback(code: str = None, error: str = None):
    if error:
        return RedirectResponse(url=f"/?error={error}", status_code=302)
    
    if not code:
        return RedirectResponse(url="/?error=no_code", status_code=302)
    
    try:
        access_token = await exchange_code_for_token(code)
        user_data = await get_github_user(access_token)
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        jwt_token = create_access_token(
            data={
                "sub": str(user_data["id"]), 
                "github_data": user_data,
                "github_access_token": access_token
            },
            expires_delta=access_token_expires
        )
        
        response = RedirectResponse(url="/", status_code=302)
        response.set_cookie(
            key="access_token",
            value=jwt_token,
            httponly=True,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=IS_PRODUCTION  # 本番ではHTTPS
        )
        
        return response
        
    except Exception as e:
        print(f"Auth error: {e}")
        return RedirectResponse(url=f"/?error=auth_failed", status_code=302)

# 他のエンドポイントは既存のままでOK

@app.get("/api/auth/me")
async def get_current_user(request: Request):
    """現在ログイン中のユーザー情報を取得"""
    token = request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = verify_token(token)
        return payload["github_data"]
    except Exception as e:
        print(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

@app.get("/api/github/repositories")
async def get_repositories(request: Request):
    """ユーザーのリポジトリ一覧を取得"""
    token = request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = verify_token(token)
        github_token = payload.get("github_access_token")
        
        if not github_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token not found"
            )
        
        repositories = await get_user_repositories(github_token)
        return repositories
        
    except Exception as e:
        print(f"Error getting repositories: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get repositories"
        )

@app.post("/api/github/create-issue")
async def create_issue(request: Request, issue_request: CreateIssueRequest):
    """GitHubイシューを作成"""
    token = request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = verify_token(token)
        github_token = payload.get("github_access_token")
        
        if not github_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token not found"
            )
        
        # イシューを作成
        issue = await create_github_issue(
            github_token,
            issue_request.repository,
            issue_request.title,
            issue_request.body,
            issue_request.labels
        )
        
        return issue
        
    except Exception as e:
        print(f"Error creating issue: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create issue"
        )

@app.post("/api/llm/generate-issues")
async def generate_issues(request: Request, generate_request: GenerateIssuesRequest):
    """マークダウンからイシューを生成"""
    token = request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        verify_token(token)
        
        # フロントエンドから受け取ったマークダウンをデバッグ出力
        print("Received from frontend:")
        print(f"Content length: {len(generate_request.markdown_content)}")
        print("First 200 chars:", repr(generate_request.markdown_content[:200]))
        
        # マークダウンが空の場合はサンプルを使用
        markdown_content = generate_request.markdown_content or SAMPLE_MARKDOWN
        
        # LLMでイシューを生成
        issues = await generate_issues_from_markdown(markdown_content)
        
        return {
            "issues": issues,
            "markdown_used": markdown_content[:200] + "..." if len(markdown_content) > 200 else markdown_content
        }
        
    except Exception as e:
        print(f"Error generating issues: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate issues"
        )

@app.get("/api/llm/sample-markdown")
async def get_sample_markdown():
    """サンプルマークダウンを取得"""
    return {"markdown": SAMPLE_MARKDOWN}

@app.post("/api/auth/logout")
async def logout():
    """ログアウト処理"""
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(key="access_token")
    return response

# SPAのルーティング対応
@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_spa(full_path: str):
    """SPAのindex.htmlを返す"""
    index_file = static_dir / "index.html" 
    
    if index_file.exists():
        print(f"Serving index.html from: {index_file}")
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    else:
        print(f"index.html not found at: {index_file}")
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>GitHub Issue Maker</title>
        </head>
        <body>
            <h1>FastAPI Server is Running!</h1>
            <p>Frontend build not found. Please check the build process.</p>
        </body>
        </html>
        """)
    
@app.get("/api/debug")
async def debug_info():
    """デバッグ情報を返す"""
    static_exists = os.path.exists("static")
    index_exists = os.path.exists("static/index.html")
    assets_exists = os.path.exists("static/assets")
    
    return {
        "static_dir_exists": static_exists,
        "index_html_exists": index_exists,
        "assets_dir_exists": assets_exists,
        "github_client_id_set": bool(os.getenv("GITHUB_CLIENT_ID")),
        "openai_api_key_set": bool(os.getenv("OPENAI_API_KEY")),
        "current_directory": os.getcwd(),
        "static_files": os.listdir("static") if static_exists else []
    }