"""markdown
# Cloudflare Workers AI 自動講評システム - 実装ガイド

このドキュメントは、Cloudflare Workers AI を使用した文芸部の自動講評システムの実装方法を説明します。

---

## 📁 ファイル構成

```
app/
├── lib/
│   ├── ai.ts              # Cloudflare Workers AI クライアント
│   └── r2Utils.ts         # R2 データ取得ユーティリティ
├── api/
│   └── analysis/
│       ├── post/route.ts  # 個別作品講評
│       ├── weekly/route.ts # 全体講評
│       └── member/route.ts # 部員分析
└── hooks/
    └── useAIAnalysis.ts   # React カスタムフック
```

---

## 🔧 環境変数設定

`wrangler.toml` に以下を追加：

```toml
[env.production]
vars = { CLOUDFLARE_ACCOUNT_ID = "your-account-id", CLOUDFLARE_API_TOKEN = "your-api-token" }
```

或いは `.env.local` に：

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

---

## 🚀 使用方法

### 1. 個別作品への講評生成

**API エンドポイント**: `POST /api/analysis/post`

**例：cURL**
```bash
curl -X POST http://localhost:3000/api/analysis/post \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "post-123",
    "title": "春の想い",
    "body": "春風が吹く...",
    "tag": "恋愛"
  }'
```

**例：フロントエンド（React）**
```typescript
import { usePostReview } from "@/app/hooks/useAIAnalysis";

export function ReviewButton({ post }: { post: Post }) {
  const { generateReview, isGenerating, review } = usePostReview();

  const handleClick = () => {
    generateReview(post.id, post.title, post.body, post.tag);
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isGenerating}>
        {isGenerating ? "講評生成中..." : "講評をもらう"}
      </button>
      {review && <p className="text-sm mt-2">{review}</p>}
    </div>
  );
}
```

**レスポンス例**
```json
{
  "postId": "post-123",
  "review": "春風と共に流れるような美しい描写ですね。特に風景描写の優雅さが印象的です。感情と風景の融合がとても良く表現されています。",
  "generatedAt": "2024-03-21T10:30:00Z"
}
```

---

### 2. 週末の全体講評生成

**API エンドポイント**: `POST /api/analysis/weekly`

**例1：日付範囲で自動集計**
```bash
curl -X POST http://localhost:3000/api/analysis/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": 1711000000000,
    "endDate": 1711500000000
  }'
```

**例2：手動データで生成**
```bash
curl -X POST http://localhost:3000/api/analysis/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "totalPosts": 15,
    "themes": ["恋愛", "冒険", "日常"],
    "commonKeywords": ["風", "心", "夜", "光"],
    "topPostMentions": ["春の想い", "心を開く", "未来への一歩"]
  }'
```

**例：フロントエンド（React）**
```typescript
import { useWeeklySummary } from "@/app/hooks/useAIAnalysis";

export function WeeklySummarySection() {
  const { generateSummary, isGenerating, summary } = useWeeklySummary();

  const handleGenerateSummary = () => {
    generateSummary({
      totalPosts: 15,
      themes: ["恋愛", "冒険"],
      commonKeywords: ["風", "心"],
      topPostMentions: ["春の想い"],
    });
  };

  return (
    <div>
      <button onClick={handleGenerateSummary} disabled={isGenerating}>
        {isGenerating ? "総括生成中..." : "今週の総括を見る"}
      </button>
      {summary && <p className="mt-4 p-4 bg-blue-50">{summary}</p>}
    </div>
  );
}
```

**レスポンス例**
```json
{
  "summary": "今週も素晴らしい創作活動をありがとうございました。恋愛、冒険、日常と、多彩なテーマでの表現が見られ、部員の皆さんの創作の幅の広さが感じられます。特に風や心といったキーワードを通じた感情表現が豊かでした。来週も皆さんの創意工夫を期待しています！",
  "aggregatedData": { /* ... */ },
  "generatedAt": "2024-03-21T18:00:00Z"
}
```

---

### 3. 部員の文体・テーマ分析

**API エンドポイント**: `POST /api/analysis/member`

**例1：自動取得（DB から）**
```bash
curl -X POST http://localhost:3000/api/analysis/member \
  -H "Content-Type: application/json" \
  -d '{
    "email": "member@example.com",
    "penName": "新しい月",
    "autoFetch": true,
    "limit": 10
  }'
```

**例2：手動で投稿リストを指定**
```bash
curl -X POST http://localhost:3000/api/analysis/member \
  -H "Content-Type: application/json" \
  -d '{
    "penName": "新しい月",
    "posts": [
      { "title": "春の想い", "body": "...", "tag": "恋愛" },
      { "title": "未来への一歩", "body": "...", "tag": "冒険" }
    ]
  }'
```

**例：フロントエンド（React）**
```typescript
import { useMemberAnalysis } from "@/app/hooks/useAIAnalysis";

export function MemberProfileCard({ member }: { member: MemberProfile }) {
  const { analyze, isAnalyzing, analysis } = useMemberAnalysis();

  const handleAnalyze = () => {
    analyze({
      email: member.email,
      penName: member.penName,
      autoFetch: true,
      limit: 15,
    });
  };

  return (
    <div className="border p-4">
      <h3>{member.penName}</h3>
      <button onClick={handleAnalyze} disabled={isAnalyzing}>
        {isAnalyzing ? "分析中..." : "プロフィール分析"}
      </button>
      {analysis && (
        <p className="text-sm text-gray-700 mt-2">{analysis}</p>
      )}
    </div>
  );
}
```

**レスポンス例**
```json
{
  "penName": "新しい月",
  "email": "member@example.com",
  "analysis": "新しい月さんの作品には叙情的な風景描写と、内省的な心理描写が大きな特徴です。特に月や夜といった要素を用いた作品が多く、それらを通じて人間の内面をしなやかに表現されています。感情の繊細さと表現力の自然さが光っています。",
  "postsAnalyzed": 10,
  "generatedAt": "2024-03-21T10:45:00Z"
}
```

---

## 🔄 データフロー図

```
フロントエンド (React + useAIAnalysis)
         ↓
  API エンドポイント
  ├── /api/analysis/post     → 個別講評
  ├── /api/analysis/weekly   → 全体講評
  └── /api/analysis/member   → 部員分析
         ↓
  Cloudflare Workers AI ライブラリ (ai.ts)
  └── getAIClient().generatePostReview / generateWeeklySummary / analyzeMemberProfile
         ↓
Cloudflare Workers AI API
  └── @cf/meta/llama-3-8b-instruct
         ↓
  レスポンス（生成されたテキスト）
         ↓
  フロントエンドに返却
```

---

## 📊 R2 との連携（オプション）

R2 に作品本文を保存している場合：

```typescript
import { getTextFromR2, saveTextToR2 } from "@/app/lib/r2Utils";

// R2 から作品を取得してAI分析
const postContent = await getTextFromR2(`posts/2024-03-21/post-123.txt`);

// AI講評結果を R2 に保存して後で参照
await saveTextToR2(
  `reviews/2024-03-21/post-123-review.txt`,
  review,
  { postId: "post-123", theme: "恋愛" }
);
```

---

## ⚙️ パフォーマンス最適化

### タイムアウト対策
AI 推論は時間がかかるため、長い作品の場合は事前に制限：

```typescript
const body =
  data.body.length > 3000
    ? data.body.substring(0, 3000) + "..."
    : data.body;
```

### バッチ処理
複数の作品に対して並列で講評を生成：

```typescript
import { usePostReviewBatch } from "@/app/hooks/useAIAnalysis";

const { generateReviewsBatch, isGenerating, reviews } = usePostReviewBatch();

await generateReviewsBatch([
  { postId: "post-1", title: "作品1", body: "..." },
  { postId: "post-2", title: "作品2", body: "..." },
]);
```

---

## 🎯 プロンプトのカスタマイズ

各関数のシステムプロンプトは `app/lib/ai.ts` 内で編集可能：

```typescript
const systemPrompt = `あなたは文学部の温かい指導者です。...`;
```

部員の特性に応じてプロンプトを調整できます：
- より詳しい講評にしたい → `max_tokens` を増加
- より簡潔にしたい → `temperature` を低下（0.5 程度）
- より創造的にしたい → `temperature` を上昇（0.9 程度）

---

## 🛠️ トラブルシューティング

### "Missing CLOUDFLARE_ACCOUNT_ID" エラー
→ 環境変数が設定されていません。`wrangler.toml` または `.env.local` を確認

### API レート制限
→ Cloudflare AI は無料枠で制限あり。バッチ処理時は間隔をあける

### タイムアウト
→ 作品が長すぎる可能性。`bodyLimit` を下げてください

---

## 📝 実装チェックリスト

- [ ] 環境変数設定完了
- [ ] `app/lib/ai.ts` をプロジェクトに追加
- [ ] `app/lib/r2Utils.ts` をプロジェクトに追加
- [ ] API ルート 3 つを追加
- [ ] `app/hooks/useAIAnalysis.ts` をプロジェクトに追加
- [ ] フロントエンドコンポーネントで `useAIAnalysis` を使用
- [ ] テスト実施

---

## 📚 参考資料

- Cloudflare AI API: https://developers.cloudflare.com/workers-ai/
- Llama 3 8B ドキュメント: https://developers.cloudflare.com/workers-ai/models/llama-3-8b-instruct/
- 本プロジェクトのスタイルガイド: `copilot-instructions.md`

---

## 💡 今後の拡張案

1. **AI 講評のキャッシング**: レビュー結果を D1 に保存して再利用
2. **マルチ言語対応**: 日本語以外のテーマにも対応
3. **リアルタイム通知**: 講評完了時にメール通知
4. **ダッシュボード**: 週単位での講評統計表示
5. **カスタムプロンプト**: 部長が講評スタイルをカスタマイズ可能

"""
