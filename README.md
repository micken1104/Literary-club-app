# Literary Club Portal

文学部向けの投稿アプリです。お題投稿、作品投稿、コメント、いいね、プロフィール設定に加えて、AI 講評・週次総括・部員分析を提供します。

## 構成

- フロントエンド: Next.js 16 + HeroUI
- 認証: NextAuth (Google ログイン)
- データベース: Cloudflare D1 (SQLite)
- AI: Cloudflare Workers AI
- ホスティング: Cloudflare Pages
- PWA: Service Worker / オフライン対応 / 追加可能
- 通知: 締め切りリマインダー (プッシュ通知)

## 主な機能

- Google ログイン
- お題投稿、作品投稿
- コメント (編集対応)
- いいね
- ペンネーム、ユーザーアイコン設定
- ライト/ダーク/システムテーマ切り替え
- 締め切り設定、締め切り後投稿制限
- AI 講評、週次総括、部員プロフィール分析

## ローカル開発

```bash
npm run dev
```

必要に応じて `yarn dev` / `pnpm dev` / `bun dev` を使用できます。

起動後に `http://localhost:3000` を開いてください。

## 環境変数

### AI講評 (Cloudflare Workers AI)

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_AI_API_TOKEN=your_ai_token
# 互換用の環境変数名も利用できます
CLOUDFLARE_API_TOKEN=your_ai_token
```

`CLOUDFLARE_AI_API_TOKEN` が優先され、`CLOUDFLARE_API_TOKEN` も互換用に利用できます。

### アイコン保存 (Cloudflare R2)

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=user-icons
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

補足:

- メールアドレスは SHA-256 ハッシュ化してファイル名に使用
- アップロード時に 128x128 JPEG へリサイズ

## デプロイ

Cloudflare Pages へのデプロイ手順は `DEPLOYMENT_GUIDE.md` を参照してください。

基本フロー:

```bash
git add .
git commit -m "your message"
git push origin main
```

## ドキュメント

- `DEPLOYMENT_GUIDE.md`: デプロイ手順
- `AI_REVIEW_IMPLEMENTATION_GUIDE.md`: AI 講評システムの実装ガイド
- `CLOUDFLARE_AI_IMPLEMENTATION_SUMMARY.md`: AI 機能の実装サマリー
- `MIGRATION_SUMMARY.md`: DynamoDB から D1 への移行内容
- `PWA_ICON_SETUP.md`: PWA アイコン設定

## ライセンス

MIT
