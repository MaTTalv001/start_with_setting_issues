import httpx
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24時間

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

if not all([SECRET_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET]):
    raise ValueError("Required environment variables are not set")

async def exchange_code_for_token(code: str) -> str:
    """GitHubの認証コードをアクセストークンに交換"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")
        
        data = response.json()
        access_token = data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")
            
        return access_token

async def get_github_user(access_token: str) -> dict:
    """GitHubのアクセストークンを使ってユーザー情報を取得"""
    async with httpx.AsyncClient() as client:
        # ユーザー基本情報を取得
        response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        user_data = response.json()
        
        # メールアドレスを取得
        try:
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {access_token}"}
            )
            
            if email_response.status_code == 200:
                emails = email_response.json()
                primary_email = next((email["email"] for email in emails if email["primary"]), None)
                if primary_email and not user_data.get("email"):
                    user_data["email"] = primary_email
        except:
            pass  # メール取得に失敗しても続行
        
        return user_data

async def get_user_repositories(access_token: str) -> list:
    """ユーザーのリポジトリ一覧を取得"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"token {access_token}"},
            params={
                "sort": "updated",
                "per_page": 50,
                "type": "owner"  # 自分が所有するリポジトリのみ
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get repositories")
        
        return response.json()

async def create_github_issue(access_token: str, repository: str, title: str, body: str, labels: list = None) -> dict:
    """GitHubにイシューを作成"""
    async with httpx.AsyncClient() as client:
        issue_data = {
            "title": title,
            "body": body
        }
        
        if labels:
            issue_data["labels"] = labels
        
        response = await client.post(
            f"https://api.github.com/repos/{repository}/issues",
            headers={"Authorization": f"token {access_token}"},
            json=issue_data
        )
        
        if response.status_code != 201:
            raise HTTPException(status_code=400, detail=f"Failed to create issue: {response.text}")
        
        return response.json()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWTアクセストークンを作成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """JWTトークンを検証"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )