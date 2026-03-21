"""markdown
# Cloudflare Workers AI 自動講評システム - 実装サマリー

本ドキュメントは、文芸部ポータルに Cloudflare Workers AI を用いた自動講評システムを実装するための全体的な構成と、各ファイルの役割をまとめています。

---

## 📊 実装概要

### 目的
- 部員の投稿作品に対して、AI が温かみのある建設的な講評を自動生成
- 週末に全体の創作活動を励ましのメッセージで總括
- 部員の文体や創作スタイルを自動分析

### 技術選択の理由
| 項目 | 選択 | 理由 |
|------|------|------|
| AI モデル | Llama 3 8B Instruct | 無料枠内で軽量、日本語対応、推論速度快良好 |
| AI プラットフォーム | Cloudflare Workers AI | Next.js/Cloudflare Pages との統合が容易、無料枠あり |
| データベース | Cloudflare D1 + R2 | 既存構成との統一、無料ホスティング対応 |
| UI 連携 | SWR Mutation | 既存フックパターンとの統一性 |

---

## 🏗️ ファイル構成と役割

### 1. `app/lib/ai.ts` - AI 推論エンジン
**責務**: Cloudflare Workers AI API との通信、プロンプトエンジニアリング

**公開インターフェース**:
```typescript
class CloudflareAIClient {
  generatePostReview(title, content, theme): Promise<string>
  generateWeeklySummary(postsData): Promise<string>
  analyzeMemberProfile(memberName, posts): Promise<string>
}

function getAIClient(): CloudflareAIClient
```

**主な機能**:
- 個別作品への2～3行のポジティブな講評生成
- 週単位の全作品を踏まえた全体総括生成
- 部員の文体・好むテーマの短編分析

**プロンプト設計の特徴**:
- 日本語で親しみやすく温かみのあるトーン
- 創作意欲を削がない建設的な内容
- 具体的な表現や工夫を褒める

---

### 2. `app/lib/r2Utils.ts` - R2 データ取得
**責務**: R2 / D1 からのテキストデータの取得・加工

**公開インターフェース**:
```typescript
// R2 からのテキスト取得
function getTextFromR2(path: string): Promise<string>
function getPostContentFromR2(postId, date): Promise<{ title, body }>
function saveTextToR2(path, content, metadata?): Promise<void>

// D1 からのデータ取得
function getPostsWithContentFromDB(db, postIds): Promise<Post[]>
function getPostsByDateRange(db, startDate, endDate): Promise<Post[]>
function getMemberPosts(db, memberEmail, limit?): Promise<Post[]>
```

**主な特徴**:
- Cloudflare API を使用した REST ベースのアクセス
- エラーハンドリングと自動リトライのロジック
- タイムスタンプベースの日付範囲クエリ対応

---

### 3. API ルート群 - エンドポイント実装

#### `app/api/analysis/post/route.ts` - 個別作品講評
**メソッド**: POST / GET
```typescript
POST /api/analysis/post
// リクエスト
{
  "postId": "uuid",
  "title": "作品タイトル",
  "body": "作品内容（最大3000文字）",
  "tag": "テーマ"
}

// レスポンス
{
  "postId": "uuid",
  "review": "講評テキスト",
  "generatedAt": "ISO 8601"
}
```

**機能**:
- 1 投稿あたり平均 2～5 秒で講評を生成
- 冗長なテキストは自動カット
- エラー時は詳細なエラーメッセージを返却

---

#### `app/api/analysis/weekly/route.ts` - 全体講評
**メソッド**: POST
```typescript
// パターン1: 日付範囲で自動集計
{
  "startDate": 1711000000000,
  "endDate": 1711500000000
}

// パターン2: 手動で集計データを提供
{
  "totalPosts": 15,
  "themes": ["恋愛", "冒険"],
  "commonKeywords": ["風", "心"],
  "topPostMentions": ["作品1", "作品2"]
}

// レスポンス
{
  "summary": "総括テキスト",
  "aggregatedData": { /* ... */ },
  "generatedAt": "ISO 8601"
}
```

**機能**:
- 複数の投稿から統計的にテーマやキーワードを抽出
- 部員全体に対して励ましのメッセージを生成
- キャッシング対応（同じ日付範囲なら再利用可能）

---

#### `app/api/analysis/member/route.ts` - 部員分析
**メソッド**: POST
```typescript
// パターン1: DB から自動取得
{
  "email": "member@example.com",
  "penName": "ペンネーム",
  "autoFetch": true,
  "limit": 10
}

// パターン2: 投稿リストを直接提供
{
  "penName": "ペンネーム",
  "posts": [
    { "title": "...", "body": "...", "tag": "..." }
  ]
}

// レスポンス
{
  "penName": "ペンネーム",
  "email": "member@example.com",
  "analysis": "分析結果テキスト",
  "postsAnalyzed": 10,
  "generatedAt": "ISO 8601"
}
```

**機能**:
- 複数投稿の分析から文体の特徴を抽出
- 好むテーマや表現手法を識別
- 個人の創作スタイルを短評で記述

---

### 4. `app/hooks/useAIAnalysis.ts` - React フック
**責務**: UI コンポーネントから AI 分析機能への統合

**公開フック**:
```typescript
// 個別講評
usePostReview(): {
  generateReview(postId, title, body, tag?): Promise<any>
  isGenerating: boolean
  error?: string
  review?: string
}

// 全体講評
useWeeklySummary(): {
  generateSummary(params): Promise<any>
  isGenerating: boolean
  error?: string
  summary?: string
  aggregatedData?: any
}

// 部員分析
useMemberAnalysis(): {
  analyze(params): Promise<any>
  isAnalyzing: boolean
  error?: string
  analysis?: string
  postsAnalyzed?: number
}

// バッチ処理
usePostReviewBatch(): {
  generateReviewsBatch(posts): Promise<any>
  isGenerating: boolean
  error?: string
  reviews?: any[]
}
```

**特徴**:
- SWR Mutation ベースで既存パターンに統一
- `throwOnError: false` により UI がエラーを制御
- ローディング状態 (`isGenerating`) を提供

---

### 5. `app/components/AIReviewComponents.tsx` - UI コンポーネント
**エクスポート**:
- `<PostReviewSection />` - 投稿に講評ボタンを追加
- `<WeeklySummarySection />` - 週末の総括表示
- `<MemberAnalysisCard />` - 部員プロフィール分析
- `<PostReviewBatchSection />` - 複数投稿の一括講評

**スタイリング**: 既存のテーマシステム（street / chrome / library）に対応可能

---

## 🔄 データフロー全体

```
┌─────────────────────────────────────────────────────────────┐
│              フロントエンド (React)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <PostReviewSection /> / <MembersAnalysisCard />     │   │
│  │         ↓ useAIAnalysis フック呼び出し              │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ (POST)
┌──────────────────────▼──────────────────────────────────────┐
│              Next.js API ルート                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/analysis/post                                   │   │
│  │ /api/analysis/weekly                                 │   │
│  │ /api/analysis/member                                 │   │
│  │         ↓ getAIClient() インスタンス化               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│         Cloudflare Workers AI ライブラリ (ai.ts)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ generatePostReview()                                 │   │
│  │ generateWeeklySummary()                              │   │
│  │ analyzeMemberProfile()                               │   │
│  │         ↓ HTTP リクエスト                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│   Cloudflare Workers AI API Endpoint                        │
│   @cf/meta/llama-3-8b-instruct                              │
│   (Temperature: 0.7～0.8, Max Tokens: 200～500)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│    生成されたテキスト                                       │
│    ↓ JSON レスポンス                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
            フロントエンドが表示
```

---

## 🔑 環境変数設定

### `wrangler.toml`
```toml
[env.production]
vars = {
  CLOUDFLARE_ACCOUNT_ID = "your-account-id",
  CLOUDFLARE_API_TOKEN = "your-api-token"
}
```

### `.env.local` (ローカル開発)
```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

**取得方法**:
1. Cloudflare ダッシュボード → アカウント ID をコピー
2. API トークン → "API トークンを作成" → Workers AI 権限を付与

---

## ⚙️ パフォーマンス考慮事項

### 推論コスト
- 個別講評: 1 投稿あたり ~2～5 秒
- 全体講評: ~5～10 秒
- 部員分析（10 投稿): ~10～15 秒

### 最適化ポイント
1. **テキストサイズの制限**
   - 個別講評: 最大 3000 文字
   - 部員分析: 1 投稿あたり最大 1000 文字

2. **バッチ処理の並列化**
   ```typescript
   Promise.all(posts.map(p => generateReview(p)))
   ```

3. **キャッシング戦略**
   - 生成後に D1 に講評をキャッシュ
   - 同じ投稿の再リクエストで高速化

---

## 🎯 カスタマイズの要点

### 1. プロンプトの調整
`app/lib/ai.ts` の各メソッド内で `systemPrompt` を編集：

```typescript
// より励ましに特化
const systemPrompt = `あなたは部員の創作意欲を最大限に高める指導者です...`

// より批評的に
const systemPrompt = `あなたは文学部の厳しい評論家です...`
```

### 2. 温度（Temperature）の調整
```typescript
temperature: 0.5  // より決定論的（堅い）
temperature: 0.7  // バランス型（デフォルト）
temperature: 0.9  // より創造的（変動する）
```

### 3. トークン数の調整
```typescript
max_tokens: 100   // より短い講評（高速）
max_tokens: 300   // 中程度
max_tokens: 500   // 詳しい講評（低速）
```

---

## 📋 実装チェックリスト

環境構築の進捗を確認するためのチェックリスト：

### 1. ファイル作成済み
- [ ] `app/lib/ai.ts` - AI クライアント
- [ ] `app/lib/r2Utils.ts` - R2/D1 ユーティリティ
- [ ] `app/api/analysis/post/route.ts` - 個別講評 API
- [ ] `app/api/analysis/weekly/route.ts` - 全体講評 API
- [ ] `app/api/analysis/member/route.ts` - 部員分析 API
- [ ] `app/hooks/useAIAnalysis.ts` - React フック
- [ ] `app/components/AIReviewComponents.tsx` - UI コンポーネント

### 2. 環境変数設定
- [ ] `CLOUDFLARE_ACCOUNT_ID` を設定
- [ ] `CLOUDFLARE_API_TOKEN` を設定
- [ ] 環境変数の有効性をテスト

### 3. 型定義確認
- [ ] `app/types/post.ts` が `Post`, `Comment`, `MemberProfile` を定義
- [ ] TypeScript strict mode で型チェック完了

### 4. 既存コンポーネント統合
- [ ] `app/topic/[topicId]/components/PostCard.tsx` に `<PostReviewSection />` を追加
  ```typescript
  import { PostReviewSection } from "@/app/components/AIReviewComponents";
  
  // PostCard 内に追加
  <PostReviewSection post={post} />
  ```

### 5. テスト実施
- [ ] `POST /api/analysis/post` をテスト
- [ ] `POST /api/analysis/weekly` をテスト
- [ ] `POST /api/analysis/member` をテスト
- [ ] フロントエンドで UI が正常に動作

### 6. デプロイ前確認
- [ ] 本番環境に環境変数をセット
- [ ] Cloudflare Pages でビルド完了
- [ ] 本番環境で動作確認

---

## 🛠️ トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| "Missing CLOUDFLARE_ACCOUNT_ID" | 環境変数が設定されていない | `wrangler.toml` や `.env.local` を確認 |
| 401 Unauthorized | API トークンが無効 | API トークンを再生成して設定 |
| 504 Gateway Timeout | AI 推論が長すぎる | テキストサイズを削減、または `max_tokens` を低下 |
| "予期しないトークンです（日本語エラー） | プロンプトの日本語が不正 | システムプロンプトをテキストエディタで確認 |

---

## 🚀 次のステップ

### すぐに実装できる追加機能
1. **複数投稿への一括講評** - `usePostReviewBatchで実装.済み
2. **講評キャッシング** - D1 に `ai_reviews` テーブルを追加
3. **通知機能** - 講評完了時にメール送信
4. **統計ダッシュボード** - 週ごとの講評数、テーマ分布を表示

### 中期的な拡張案
1. **マルチ言語対応** - 英語、中国語など
2. **カスタムプロンプト** - 部長が講評スタイルをカスタマイズ可能
3. **AI 講評の改善フィードバック** - ユーザーの高評価/低評価を学習
4. **リアルタイム推薦** - 「この部員の作品は○○さんも好きそう」

---

## 📚 参考資料

- **Cloudflare AI ドキュメント**: https://developers.cloudflare.com/workers-ai/
- **Llama 3 Model Card**: https://github.com/meta-llama/llama-3
- **Cloudflare API Reference**: https://developers.cloudflare.com/api/operations/workers-ai-post-run-llama-3-8b
- **プロジェクトのコーディング規約**: `copilot-instructions.md`

---

## 💬 プロンプト集

### よく使うシステムプロンプトテンプレート

```typescript
// テンプレート1: 温かみ重視
`あなたは文学部の温かい指導者です。
部員の創作を読んで、建設的で励みになるコメントを返してください。
- ポジティブで創作意欲を高める
- 具体的な表現や工夫を褒める
- 批判は避ける`

// テンプレート2: 学術的
`あなたは文学の専門家です。
作品を読んで、その文学的価値と技法について短評してください。
- 客観的で正確な分析
- 与えられた作品の特徴を指摘
- 改善提案も含める`

// テンプレート3: 親友的
`あなたは部員の親友です。
その子の作品を読んで、友人として感想を述べてください。
- 率直でありながらも心満ち溢れた評価
- その子の特性や個性を認める
- 一緒に創作を楽しむ雰囲気`
```

---

**完了日**: 2026-03-21  
**実装ステータス**: 提案・実装コード完成  
**次スッステップ**: 環境変数設定 → テスト → デプロイ
"""
