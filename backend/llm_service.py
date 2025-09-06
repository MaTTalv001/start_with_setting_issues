import os
import json
from typing import List, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ISSUE_GENERATION_PROMPT = """
あなたは経験豊富なソフトウェア開発のプロジェクトマネージャーです。
以下の要件定義マークダウンを分析して、GitHubイシューとして登録すべき具体的なタスクを生成してください。

## 要求事項:
1. 各イシューは実装可能な具体的なタスクに分解してください
2. タイトルは絵文字付きで簡潔に（例: 🐛 バグ修正: XXX、✨ 新機能: XXX、📚 ドキュメント: XXX）
3. 本文にはタスクの詳細、受け入れ条件、実装のヒントを含めてください
4. 適切なラベルを付けてください（bug, enhancement, documentation, testing, refactoring など）
5. 優先度を1-5で設定してください（1が最高優先度、5が最低優先度）
6. 最大60個程度のイシューに分解してください

## JSON出力形式:
以下の正確なJSON構造で出力してください：

{{
  "issues": [
    {{
      "title": "🐛 バグ修正: XXX",
      "body": "## 概要\\nタスクの詳細説明\\n\\n## 受け入れ条件\\n- [ ] 条件1\\n- [ ] 条件2\\n\\n## 実装のヒント\\n実装に関するアドバイス",
      "labels": ["bug", "priority-high"],
      "priority": 1
    }}
  ]
}}

## 要件定義マークダウン:
{markdown_content}

**重要**: 必ず上記のJSON形式で回答してください。JSONのみを出力し、説明文やコードブロック（```）は含めないでください。
"""

def validate_issue(issue: Any, index: int) -> Dict[str, Any] | None:
    """単一のイシューをバリデーション"""
    if not isinstance(issue, dict):
        print(f"Issue {index}: Not a dictionary")
        return None
    
    # タイトルのバリデーション
    title = issue.get("title")
    if not isinstance(title, str) or not title.strip():
        print(f"Issue {index}: Invalid title")
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
    
    return {
        "title": title.strip(),
        "body": body,
        "labels": labels,
        "priority": priority
    }

def validate_issues_response(data: Any) -> List[Dict[str, Any]]:
    """イシューレスポンス全体をバリデーション"""
    if not isinstance(data, dict):
        print("Response is not a dictionary")
        return []
    
    if "issues" not in data:
        print("No 'issues' key found in response")
        return []
    
    issues = data["issues"]
    if not isinstance(issues, list):
        print("'issues' is not a list")
        return []
    
    if len(issues) == 0:
        print("No issues found in response")
        return []
    
    if len(issues) > 20:
        print(f"Too many issues ({len(issues)}), limiting to 20")
        issues = issues[:20]
    
    validated_issues = []
    for i, issue in enumerate(issues):
        validated_issue = validate_issue(issue, i)
        if validated_issue:
            validated_issues.append(validated_issue)
        else:
            print(f"Skipping invalid issue at index {i}")
    
    return validated_issues

async def generate_issues_from_markdown(markdown_content: str) -> List[Dict]:
    """マークダウンからイシューを生成（JSON mode + 手動バリデーション）"""
    
    print("=" * 50)
    print("Received markdown content:")
    print(f"Length: {len(markdown_content)} characters")
    print("First 200 characters:")
    print(repr(markdown_content[:200]))
    print("=" * 50)
    
    try:
        # JSON modeでリクエスト
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user", 
                    "content": ISSUE_GENERATION_PROMPT.format(markdown_content=markdown_content)
                }
            ],
            max_tokens=2000,
            temperature=0.3,
            response_format={"type": "json_object"}  # JSON modeを有効化
        )
        
        result_text = response.choices[0].message.content.strip()
        
        print("=" * 50)
        print("OpenAI response (JSON mode):")
        print(result_text[:500] + "..." if len(result_text) > 500 else result_text)
        print("=" * 50)
        
        # JSONをパース
        try:
            parsed_json = json.loads(result_text)
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed: {e}")
            print(f"Raw response: {repr(result_text[:200])}")
            return get_fallback_issues()
        
        # 手動バリデーション
        validated_issues = validate_issues_response(parsed_json)
        
        if validated_issues:
            print(f"Successfully validated {len(validated_issues)} issues")
            return validated_issues
        else:
            print("No valid issues found, using fallback")
            return get_fallback_issues()
        
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return get_fallback_issues()

def get_fallback_issues() -> List[Dict]:
    """LLM呼び出しに失敗した場合のフォールバックイシュー"""
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
        },
        {
            "title": "🧪 テスト環境構築",
            "body": "## 概要\nテスト環境とテストケースを構築します。\n\n## 受け入れ条件\n- [ ] ユニットテストの設定\n- [ ] 結合テストの設定\n- [ ] CI/CDパイプラインの構築\n\n## 実装のヒント\nテスト駆動開発（TDD）を採用することを検討してください。",
            "labels": ["testing", "priority-medium"],
            "priority": 2
        },
        {
            "title": "🚀 デプロイメント設定",
            "body": "## 概要\n本番環境へのデプロイメント設定を行います。\n\n## 受け入れ条件\n- [ ] 本番環境の構築\n- [ ] 自動デプロイの設定\n- [ ] 監視・ログ設定\n\n## 実装のヒント\nDocker化とKubernetesの活用を検討してください。",
            "labels": ["deployment", "priority-low"],
            "priority": 3
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

### 4. 決済機能
- クレジットカード決済
- デジタルウォレット対応
- 注文確認メール
- 注文履歴

### 5. 管理機能
- 商品登録・編集
- 注文管理
- ユーザー管理
- 売上レポート

## 技術要件

### フロントエンド
- React 18 + TypeScript
- Tailwind CSS + DaisyUI
- レスポンシブデザイン

### バックエンド
- FastAPI + Python
- PostgreSQL
- Redis（セッション管理）

### インフラ
- Docker対応
- AWS デプロイ
- CI/CD パイプライン

## 非機能要件

### パフォーマンス
- ページ読み込み時間 3秒以内
- 同時アクセス 1000ユーザー対応

### セキュリティ
- HTTPS必須
- XSS、SQLインジェクション対策
- GDPR準拠

### 可用性
- 99.9%以上の稼働率
- 定期バックアップ

## 制約事項
- 開発期間: 3ヶ月
- 予算制限あり
- 既存データの移行が必要"""