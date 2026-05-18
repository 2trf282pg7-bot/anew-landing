# Anew — リレーションシップサポートアプリ MVP

ゴットマンメソッドと動機づけ面接（MI）に基づいたリレーションシップサポートアプリです。

## 技術スタック

- **Next.js 15** (App Router)
- **Tailwind CSS**
- **Anthropic SDK** (サーバーサイドのみ)
- **Vercel** デプロイ前提

## ローカル起動手順

### 1. 依存関係のインストール

```bash
cd anew-app
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を開き、Anthropic API キーを設定します：

```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

APIキーは [Anthropic Console](https://console.anthropic.com/) で取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## Vercel デプロイ手順

### 方法1: Vercel CLI

```bash
npm install -g vercel
vercel
```

プロンプトに従って設定し、環境変数 `ANTHROPIC_API_KEY` を入力します。

### 方法2: GitHub 連携

1. このリポジトリを GitHub に push
2. [vercel.com](https://vercel.com) にログイン
3. "New Project" → リポジトリを選択 → **Root Directory を `anew-app` に設定**
4. "Environment Variables" に `ANTHROPIC_API_KEY` を追加
5. "Deploy" をクリック

## 画面構成

| ルート | 説明 |
|--------|------|
| `/` | チャット画面（Phase1：傾聴） |
| `/paywall` | パターン診断 + CTA |
| `/suggestions` | 今夜の提案 3枚 |
| `/done` | 完了画面 |

## ディレクトリ構成

```
anew-app/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # POST /api/chat
│   │   └── suggestions/route.ts # POST /api/suggestions
│   ├── layout.tsx
│   ├── page.tsx                 # チャット画面
│   ├── paywall/page.tsx         # ペイウォール
│   ├── suggestions/page.tsx     # 提案画面
│   └── done/page.tsx            # 完了画面
├── components/
│   ├── ChatBubble.tsx
│   ├── QuickReplies.tsx
│   └── SuggestionCard.tsx
├── lib/
│   └── prompts.ts               # システムプロンプト定数
└── .env.example
```
