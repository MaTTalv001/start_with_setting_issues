import os
import json
from typing import List, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ISSUE_GENERATION_PROMPT = """
あなたは経験豊富なソフトウェアエンジニア・テックリードです。
以下の要件定義マークダウンを、実装者の視点で実際に開発可能な具体的なタスクに分解してください。

## エンジニア視点での分解方針:
1. **実装の粒度**: 1-3日で完了できる具体的なタスクに分解
2. **技術領域別分類**: フロントエンド、バックエンド、データベース、インフラ、テストなど
3. **依存関係の明確化**: 前提となるタスクや並行実行可能なタスクを考慮
4. **技術的詳細**: 使用技術、アーキテクチャ、実装パターンを具体化
5. **コードレベルの受け入れ条件**: テスト可能で検証可能な条件

## タスク分類指針:
- 🏗️ **インフラ・環境構築**: Docker、CI/CD、デプロイメント
- 🎨 **フロントエンド**: UI/UX、コンポーネント、状態管理
- ⚙️ **バックエンド**: API、ビジネスロジック、認証
- 🗄️ **データベース**: スキーマ設計、マイグレーション、クエリ最適化
- 🧪 **テスト**: ユニット、統合、E2E、パフォーマンステスト
- 📚 **ドキュメント**: API仕様、設計資料、運用手順
- 🔧 **設定・最適化**: パフォーマンス、セキュリティ、監視

## 粒度の目安:
- ❌ 悪い例: "ユーザー認証機能の実装"
- ✅ 良い例: "JWT認証ミドルウェアの実装"、"ログイン画面のUI作成"、"認証API のテスト作成"

## JSON出力形式:
{{
  "issues": [
    {{
      "title": "🎨 フロントエンド: ログインフォームコンポーネント実装",
      "body": "## 概要\\nログイン機能のフロントエンドコンポーネントを実装する\\n\\n## 技術詳細\\n- React + TypeScript\\n- フォームバリデーション (react-hook-form)\\n- Tailwind CSS でスタイリング\\n\\n## 実装内容\\n- メールアドレス・パスワード入力フィールド\\n- クライアントサイドバリデーション\\n- ローディング状態管理\\n- エラーメッセージ表示\\n\\n## 受け入れ条件\\n- [ ] 必須項目のバリデーションが動作する\\n- [ ] API呼び出し中はボタンが無効化される\\n- [ ] エラーレスポンスを適切に表示する\\n- [ ] レスポンシブ対応（モバイル・デスクトップ）\\n- [ ] アクセシビリティ要件を満たす（ARIA属性）\\n\\n## 実装ファイル\\n- `components/auth/LoginForm.tsx`\\n- `components/auth/LoginForm.test.tsx`\\n- `hooks/useAuth.ts`\\n\\n## 依存関係\\n- 前提: API認証エンドポイント実装完了\\n- 並行可能: パスワードリセット画面",
      "labels": ["frontend", "component", "auth", "priority-high"],
      "priority": 1
    }}
  ]
}}

## 分解対象の要件定義:
{markdown_content}

**重要**: 
- 15-25個程度の具体的なタスクに分解してください
- 各タスクは1-3日で実装可能な粒度にしてください
- 技術的な実装詳細を含めてください
- 実際のファイル名やディレクトリ構造を想定してください
- JSON形式のみで回答し、説明文は含めないでください
"""

def validate_issue(issue: Any, index: int) -> Dict[str, Any] | None:
    """単一のイシューをバリデーション"""
    try:
        if not isinstance(issue, dict):
            print(f"Issue {index}: Not a dictionary, got {type(issue)}")
            return None
        
        # タイトルのバリデーション
        title = issue.get("title")
        if not isinstance(title, str) or not title.strip():
            print(f"Issue {index}: Invalid title: {repr(title)}")
            return None
        
        # 長すぎるタイトルを切り詰める
        if len(title) > 200:
            title = title[:197] + "..."
        
        # 本文のバリデーション
        body = issue.get("body", "")
        if not isinstance(body, str):
            body = str(body) if body else "No description provided"
        
        # ラベルのバリデーション
        labels = issue.get("labels", [])
        if not isinstance(labels, list):
            labels = []
        else:
            # 文字列のラベルのみを保持
            labels = [str(label) for label in labels if isinstance(label, str) and label.strip()]
        
        # 優先度のバリデーション
        priority = issue.get("priority", 3)
        if not isinstance(priority, int):
            try:
                priority = int(priority)
            except (ValueError, TypeError):
                priority = 3
        
        # 優先度を1-5の範囲に制限
        priority = max(1, min(5, priority))
        
        validated = {
            "title": title.strip(),
            "body": body,
            "labels": labels,
            "priority": priority
        }
        
        print(f"Issue {index} validated successfully: {validated['title']}")
        return validated
        
    except Exception as e:
        print(f"Error validating issue {index}: {e}")
        return None

def validate_issues_response(data: Any) -> List[Dict[str, Any]]:
    """イシューレスポンス全体をバリデーション"""
    try:
        print(f"Validating response data type: {type(data)}")
        
        if not isinstance(data, dict):
            print(f"Response is not a dictionary, got: {type(data)}")
            print(f"Response content: {repr(data)}")
            return []
        
        print(f"Response keys: {list(data.keys())}")
        
        if "issues" not in data:
            print("No 'issues' key found in response")
            print(f"Available keys: {list(data.keys())}")
            return []
        
        issues = data["issues"]
        print(f"Issues type: {type(issues)}, length: {len(issues) if isinstance(issues, list) else 'N/A'}")
        
        if not isinstance(issues, list):
            print(f"'issues' is not a list, got: {type(issues)}")
            return []
        
        if len(issues) == 0:
            print("No issues found in response")
            return []
        
        if len(issues) > 20:
            print(f"Too many issues ({len(issues)}), limiting to 20")
            issues = issues[:20]
        
        validated_issues = []
        for i, issue in enumerate(issues):
            print(f"Validating issue {i}: {type(issue)}")
            validated_issue = validate_issue(issue, i)
            if validated_issue:
                validated_issues.append(validated_issue)
            else:
                print(f"Skipping invalid issue at index {i}")
        
        print(f"Successfully validated {len(validated_issues)} out of {len(issues)} issues")
        return validated_issues
        
    except Exception as e:
        print(f"Error in validate_issues_response: {e}")
        return []

async def generate_issues_from_markdown(markdown_content: str) -> List[Dict]:
    """マークダウンからイシューを生成（JSON mode + 手動バリデーション）"""
    
    print("=" * 60)
    print("GENERATE ISSUES DEBUG START")
    print(f"Input markdown length: {len(markdown_content)} characters")
    print(f"First 300 characters: {repr(markdown_content[:300])}")
    print(f"OpenAI API Key set: {bool(os.getenv('OPENAI_API_KEY'))}")
    print("=" * 60)
    
    if not markdown_content or not markdown_content.strip():
        print("Empty markdown content, using sample")
        markdown_content = SAMPLE_MARKDOWN
    
    try:
        # OpenAI API call with enhanced error handling
        print("Making OpenAI API call...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user", 
                    "content": ISSUE_GENERATION_PROMPT.format(markdown_content=markdown_content)
                }
            ],
            max_tokens=4000,
            temperature=0.2,
            response_format={"type": "json_object"}  # JSON modeを有効化
        )
        
        print("OpenAI API call successful")
        result_text = response.choices[0].message.content.strip()
        
        print("=" * 60)
        print("OpenAI RAW RESPONSE:")
        print(f"Response length: {len(result_text)} characters")
        print("Full response:")
        print(result_text)
        print("=" * 60)
        
        # JSONをパース
        try:
            print("Parsing JSON...")
            parsed_json = json.loads(result_text)
            print(f"JSON parsed successfully. Type: {type(parsed_json)}")
            print(f"Parsed JSON keys: {list(parsed_json.keys()) if isinstance(parsed_json, dict) else 'Not a dict'}")
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed: {e}")
            print(f"Failed at position: {e.pos}")
            print(f"Raw response (first 500 chars): {repr(result_text[:500])}")
            print("Using fallback issues")
            return get_fallback_issues()
        
        # 手動バリデーション
        print("Starting validation...")
        validated_issues = validate_issues_response(parsed_json)
        
        if validated_issues and len(validated_issues) > 0:
            print(f"SUCCESS: Generated {len(validated_issues)} valid issues")
            for i, issue in enumerate(validated_issues):
                print(f"  {i+1}. {issue['title']}")
            print("=" * 60)
            return validated_issues
        else:
            print("FAILURE: No valid issues found after validation, using fallback")
            print("=" * 60)
            return get_fallback_issues()
        
    except Exception as e:
        print(f"EXCEPTION in OpenAI API call: {type(e).__name__}: {e}")
        import traceback
        print("Full traceback:")
        print(traceback.format_exc())
        print("Using fallback issues")
        print("=" * 60)
        return get_fallback_issues()

def get_fallback_issues() -> List[Dict]:
    """LLM呼び出しに失敗した場合のフォールバックイシュー"""
    print("RETURNING FALLBACK ISSUES")
    return [
        {
            "title": "🔧 プロジェクト初期設定",
            "body": "## 概要\nプロジェクトの初期設定を行います。\n\n## 受け入れ条件\n- [ ] 開発環境の構築\n- [ ] 基本的なプロジェクト構造の作成\n- [ ] 依存関係の設定\n\n## 実装のヒント\n既存のプロジェクトテンプレートを活用して効率的にセットアップを行ってください。",
            "labels": ["setup", "priority-high"],
            "priority": 1
        },
        {
            "title": "📚 ドキュメント整備",
            "body": "## 概要\nプロジェクトのドキュメントを整備します。\n\n## 受け入れ条件\n- [ ] README.mdの作成\n- [ ] API仕様書の作成\n- [ ] 開発ガイドの作成\n\n## 実装のヒント\nMarkdown形式で統一し、自動生成ツールの活用を検討してください。",
            "labels": ["documentation", "priority-medium"],
            "priority": 2
        },
        {
            "title": "✨ 基本機能の実装",
            "body": "## 概要\nアプリケーションの基本機能を実装します。\n\n## 受け入れ条件\n- [ ] 基本的なUI構造の作成\n- [ ] API エンドポイントの実装\n- [ ] データベース設計\n\n## 実装のヒント\nMVPアプローチで最小限の機能から始めてください。",
            "labels": ["enhancement", "priority-high"],
            "priority": 1
        }
    ]

# サンプルマークダウン
SAMPLE_MARKDOWN = """# ECサイト リニューアル プロジェクト

## プロジェクト概要
既存のECサイトを現代的な技術スタックでリニューアルし、ユーザビリティとパフォーマンスを向上させる。

## 機能要件

### 1. ユーザー認証
- ユーザー登録・ログイン機能
- SNSログイン（Google、Facebook）
- パスワードリセット機能
- プロフィール管理

### 2. 商品管理
- 商品一覧表示（検索・フィルタリング）
- 商品詳細ページ
- レビュー・評価システム
- 在庫管理

### 3. ショッピングカート
- カートへの商品追加・削除
- 数量変更
- 合計金額計算
- セッション維持

## 技術要件

### フロントエンド
- React 18 + TypeScript
- Tailwind CSS + DaisyUI
- レスポンシブデザイン

### バックエンド
- FastAPI + Python
- PostgreSQL
- Redis（セッション管理）

## 制約事項
- 開発期間: 3ヶ月
- 予算制限あり
- 既存データの移行が必要"""