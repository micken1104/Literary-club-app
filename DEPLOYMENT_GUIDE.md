# Cloudflare Pages デプロイ完全ガイド

このプロジェクトは **DynamoDB から Cloudflare D1** へ移行されました。  
Cloudflare Pages で無料ホストできます！

---

## 📋 前提条件

- Cloudflare アカウント（無料）
- GitHub アカウント
- このリポジトリをプッシュ済み

---

## 🚀 デプロイの 6 ステップ

### ステップ 0️⃣ GitHub へプッシュ

このコードを GitHub にプッシュします。

#### **ローカルで初期化（初回のみ）**

```bash
# プロジェクトディレクトリへ移動
cd path/to/literary-club-app

# Git 初期化（未初期化の場合）
git init

# リモートリポジトリを追加（YOUR_USERNAME を自分の名前に変更）
git remote add origin https://github.com/YOUR_USERNAME/literary-club-app.git
```

#### **すべての変更をプッシュ**

```bash
# すべてのファイルをステージング
git add .

# コミット
git commit -m "Migrate from DynamoDB to Cloudflare D1

- Replace DynamoDB SDK with Cloudflare D1 REST API
- Update API routes (/api/posts, /api/comments, /api/likes)
- Add D1 database client (app/lib/db.ts)
- Add database schema (migrations/0001_init.sql)
- Update environment variables for Cloudflare
- Add deployment guide for Cloudflare Pages"

# GitHub にプッシュ
git push -u origin main
```

**確認**：GitHub Web で https://github.com/YOUR_USERNAME/literary-club-app を開いて、ファイルが表示されていることを確認

#### **自動デプロイ設定後は**

```bash
# 変更があるたびに以下を実行
git add .
git commit -m "描写的なコミットメッセージ"
git push origin main
```

→ **自動的に Cloudflare Pages がビルド・デプロイを実行します！** 🚀

---

## 🚀 デプロイの 6 ステップ（Cloudflare 側）

### ステップ 1️⃣ Cloudflare D1 データベースを作成

```bash
# ローカルで確認用（オプション）
npm install -D wrangler

# Cloudflare を初期化
npx wrangler login
# → ブラウザで Cloudflare にログイン
```

Cloudflare ダッシュボード：[https://dash.cloudflare.com](https://dash.cloudflare.com)

1. **左サイドバー** → **D1** をクリック
2. **「データベースを作成」** をクリック
3. データベース名を入力（例：`lit-club-database`）
4. **リージョン**：`apac`（日本に最も近い）を選択
5. **「作成」** をクリック

**取得する情報**（後で必要）：
- Database ID（ダッシュボードの「概要」タブに表示）

### ステップ 2️⃣ D1 テーブルを作成

Cloudflare 側で以下の SQL を実行：

```sql
-- 投稿テーブル
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '創作',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- コメントテーブル
CREATE TABLE IF NOT EXISTS comments (
  postId TEXT NOT NULL,
  commentId TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);

-- いいねテーブル
CREATE TABLE IF NOT EXISTS likes (
  postId TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_posts_createdAt ON posts(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_comments_postId ON comments(postId);
CREATE INDEX IF NOT EXISTS idx_likes_postId ON likes(postId);
```

**やり方**：
1. Cloudflare ダッシュボード → D1 → `lit-club-database`
2. **「Console」** タブをクリック
3. 上の SQL をコピペして実行

### ステップ 2.5️⃣ 掲示板専用テーブルを作成

メインDB（例：`lit-club-database`）の Console で、
`migrations/0014_create_board_tables.sql` の SQL を実行します。

作成されるテーブル：
- `boardThreads`
- `boardComments`

---

### ステップ 3️⃣ Cloudflare API トークンを作成

1. Cloudflare ダッシュボード → **右上プロフィール**
2. **API トークン** → **トークンを作成**
3. **カスタムトークン**を選択
4. 以下の権限を与える：
   - `d1:read`
   - `d1:edit`
5. **「続行」** → **「作成」**

**トークンをコピー**（二度と表示されません）

---

### ステップ 4️⃣ GitHub に環境変数を設定

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 以下を追加（3 つ）：

| 名前 | 値 |
|------|-----|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボード右下に表示 |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 の「概要」タブから |
| `CLOUDFLARE_API_TOKEN` | ステップ 3 で作成したトークン |

---

### ステップ 5️⃣ Cloudflare Pages と GitHub を連携

1. Cloudflare ダッシュボード → **Pages**
2. **Git に接続** → **GitHub 接続**
3. GitHub 認可
4. リポジトリを選択 → `literary-club-app`
5. **フレームワークプリセット**：`Next.js` を選択
6. **ビルドコマンド**：`npm run build`
7. **ビルド出力ディレクトリ**：`.next`
8. **環境変数**を追加：
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
   - `CLOUDFLARE_API_TOKEN`
9. **デプロイをスケジュール** をクリック

**✅ デプロイ完了！**

---

## 🔍 トラブルシューティング

### API が 500 エラーを返す場合

```
❌ "Missing Cloudflare environment variables"
```

**原因**：環境変数が設定されていない

**解決**： Cloudflare Pages → **設定** → **環境変数** で確認

---

### D1 テーブルが見つからない

```
❌ "Error: SQLITE_ERROR: no such table: posts"
```

**原因**：SQL テーブルが作成されていない

**解決**：ステップ 2 の SQL を再度実行

---

### API トークンが無効

```
❌ "401 Unauthorized"
```

**原因**：トークンの有効期限切れまたは権限不足

**解決**：新しいトークンを作成して更新

---

## 📊 DynamoDB → D1 への変更点

| 機能 | DynamoDB | D1 |
|------|---------|-----|
|ホスト|AWS|Cloudflare|
|コスト|有料（従量課金）|無料（月 50GB まで）|
|ドライバー|@aws-sdk|HTTP REST API|
|セットアップ|複雑|シンプル|
|スケーリング|自動|制限あり |
|キューリ|キー指定またはスキャン|SQL（任意）|

---

## 💡 コスト比較

### 月額料金（小規模利用）

| サービス | 月額 |
|---------|------|
| **DynamoDB** | $30～100 |
| **Cloudflare D1** | **無料** ⭐ |
| **Cloudflare Pages** | **無料** ⭐ |

**年間削減額**： 最大 $960 🎉

---

## 🛠️ ローカル開発

```bash
# 開発サーバー起動
npm run dev

# ブラウザで開く
# http://localhost:3000
```

**注意**：ローカルでは環境変数から Cloudflare D1 REST API にアクセスします

---

## 📝 API 仕様

### 投稿（POST /api/posts）

```javascript
// リクエスト
{
  "title": "投稿タイトル",
  "body": "本文...",
  "author": "著者名",
  "tag": "創作"  // オプション
}

// レスポンス
{
  "message": "Success",
  "id": "uuid"
}
```

### その他

詳細は `app/lib/db.ts` を参照

---

## 🆘 サポート

- Cloudflare Docs：https://developers.cloudflare.com/d1/
- Next.js Docs：https://nextjs.org/docs

---

## ✅ デプロイ完了後

### Cloudflare Pages のデプロイ確認

1. Cloudflare ダッシュボード → **Pages**
2. `literary-club-app` をクリック
3. **デプロイ** タブで最新の状態を確認
   - 🟢 **Success**：デプロイ成功！
   - 🔴 **Failed**：ログを確認してエラーを修正

### 本番 URL

```
https://your-project-name.pages.dev
```

例：
```
https://literary-club-app-123abc.pages.dev
```

Cloudflare ダッシュボード（Pages → Settings → Domain） で確認できます

---

## 🔄 更新・変更をデプロイする

コード変更があるたびに：

```bash
# 1️⃣ ローカルで変更を加える
vim app/api/posts/route.ts  # 例

# 2️⃣ 変更をテスト
npm run dev
# http://localhost:3000 で確認

# 3️⃣ 変更をコミット
git add .
git commit -m "Fix: API response format"

# 4️⃣ GitHub へプッシュ
git push origin main
```

→ **自動的に Cloudflare Pages がビルド＆デプロイ！** ✨

### デプロイ進行状況の確認

```bash
# GitHub Web で
1. Pull requests / Actions タブ
2. 最新のワークフローをクリック
3. ビルド・デプロイ進行状況を確認
```

または

```bash
# Cloudflare ダッシュボード（Pages ページの Deployments）
```

---

## 🆘 更新でエラーが出た場合

### ビルドエラー

```bash
# ローカルで確認
npm run build

# エラーメッセージを確認して修正
# → git add . → git commit → git push
```

### ランタイムエラー（500 等）

```bash
# 1. Cloudflare Pages → Settings → Environment variables
#    環境変数が正しいか確認

# 2. Cloudflare D1 → Console
#    テーブルが存在するか確認

# 3. 本番環境で実行
npm run dev  # ローカルで再現確認
```

---

**🎊 デプロイ完了です！**
