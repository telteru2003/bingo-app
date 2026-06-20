# リアルタイムビンゴアプリ (Bingo App)

Next.jsとSupabaseを使用して構築された、リアルタイムで遊べるビンゴアプリです。

## 🚀 アプリへのアクセス

以下のリンクから各ページにアクセスできます。

*(※ Vercel等にデプロイ済みの場合は、以下のリンク先URLを本番環境のものに書き換えてください。)*

- **[🎮 プレイヤーページを開く](https://bingo-app-psi-one.vercel.app/)**
- **[👑 管理者ページを開く](https://bingo-app-psi-one.vercel.app/admin)**

---

## 💻 ローカル環境での起動方法

このプロジェクトをご自身のPCで動かすための手順です。

### 1. 依存パッケージのインストール
```bash
npm install
# または
yarn install
# または
pnpm install
```

### 2. 環境変数の設定
プロジェクトのルートディレクトリに `.env.local` ファイルを作成し、Supabaseのプロジェクト設定から以下の情報を取得して設定してください。
```env
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase_ANON_KEY
```

### 3. 開発サーバーの起動
```bash
npm run dev
# または
yarn dev
# または
pnpm dev
```

起動後、ブラウザで以下のURLにアクセスして動作を確認できます。
- プレイヤーページ： [https://bingo-app-psi-one.vercel.app/](https://bingo-app-psi-one.vercel.app/)
- 管理者ページ： [https://bingo-app-psi-one.vercel.app/admin](https://bingo-app-psi-one.vercel.app/admin)

## 🛠 使用技術

- [Next.js](https://nextjs.org/) (App Router)
- [React](https://reactjs.org/)
- [Supabase](https://supabase.com/) (リアルタイム通信機能等)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) (アニメーション)
- [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) (紙吹雪演出)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) / [react-qr-code](https://www.npmjs.com/package/react-qr-code) (QRコード関連)
