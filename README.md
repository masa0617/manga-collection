# マンガ棚（マンガコレクション管理アプリ）

スマホのブラウザで動く、シリーズ単位でマンガの巻を管理するWebアプリです。
データはすべて端末内の IndexedDB に保存され、外部サーバーには送信されません
（書誌情報の取得時のみ openBD / Google Books API にISBNを問い合わせます）。

## 主な機能

- カメラでISBNバーコードをスキャンして自動登録（手入力にも対応）
- シリーズ単位管理、ホーム画面は表紙グリッド／リスト表示切替、50音順／最近追加した順の並び替え
- シリーズ詳細画面は作者・出版社・掲載誌などの情報中心レイアウト、代表表紙は手動差し替え可能
- 所持巻の抜け（欠番）を自動検知し、⚠️マークと詳細メッセージで通知
- 発売日が最近の所持巻があれば「新刊」バッジを表示
- ホーム画面からシリーズ単位で削除、詳細画面から巻単位で削除
- 前回バックアップから7日 or 5冊追加でバナー通知 → タップでJSONを共有シート／ダウンロード保存

## ローカルでの動作確認

### 1. Node.js のインストール

このプロジェクトのビルドには Node.js（LTS版、v18以上推奨）が必要です。
現在この端末には Node.js が見つかりませんでした。以下のいずれかの方法でインストールしてください。

- 公式サイトから: https://nodejs.org/ja （LTS版をダウンロードしてインストーラーを実行）
- winget を使う場合（管理者権限のPowerShellで実行）:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

インストール後、**PowerShellを再起動**してから以下を実行して確認してください。

```powershell
node -v
npm -v
```

### 2. 依存パッケージのインストール

```powershell
cd C:\Users\masa\manga-app
npm install
```

### 3. 開発サーバーの起動

```powershell
npm run dev
```

表示されたURL（例: http://localhost:5173）にPCのブラウザでアクセスして確認できます。

**カメラ機能をスマホの実機で確認する場合**は、`getUserMedia` はHTTPS（またはlocalhost）でしか動作しません。
同一Wi-Fi内のスマホから確認したい場合は以下のようにネットワーク経由で起動し、

```powershell
npm run dev -- --host
```

表示される `Network:` のURL（例: `https://192.168.x.x:5173`）にスマホでアクセスしてください。
ただし通常のVite開発サーバーはHTTP配信のため、スマホSafari等ではカメラ許可が出ない場合があります。
その場合は下記のデプロイ（Vercel/GitHub Pages）を行い、発行されるHTTPSのURLで実機確認するのが確実です。

### 4. 本番ビルドの確認

```powershell
npm run build
npm run preview
```

## 表紙画像を安定して取得するために（Google Books APIキーの設定）

書誌情報は openBD → 国立国会図書館サーチ(NDL) → Google Books の順で問い合わせますが、
**Google BooksはAPIキーなしでは現在ほぼ利用できません**（キー未設定の場合、Googleの匿名アクセス上限が
1日0件に制限されているため、常にエラーになります）。openBDとNDLは書誌情報（タイトル・作者等）には強い一方、
表紙画像を持たないISBNも多いため、表紙画像の取得を安定させたい場合は無料のGoogle Books APIキーの設定を推奨します。

### APIキーの取得手順（無料）

1. https://console.cloud.google.com/ にアクセスし、Googleアカウントでログイン
2. 新しいプロジェクトを作成（例: "manga-app"）
3. 左メニュー「APIとサービス」→「ライブラリ」→ "Books API" を検索して有効化
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」を選択
5. 生成されたAPIキーをコピー（安全のため、作成したキーの「アプリケーションの制限」で自分のVercelドメインを設定しておくと安心です）

### ローカルでの設定

プロジェクト直下に `.env.local` を作成し、以下を記述します（このファイルは `.gitignore` により
コミットされません）。

```
VITE_GOOGLE_BOOKS_API_KEY=取得したAPIキー
```

### Vercelでの設定

Vercelダッシュボードのプロジェクト → Settings → Environment Variables で、
`VITE_GOOGLE_BOOKS_API_KEY` という名前で同じ値を追加し、再デプロイしてください
（ビルド時に埋め込まれる値なので、環境変数追加後は再デプロイが必要です）。

APIキーを設定しない場合でも、openBD・NDLからの書誌情報取得やタイトル・巻数の自動入力は
問題なく動作します（表紙画像が見つからないケースが増えるだけです）。

## デプロイ方法（無料ホスティング）

このアプリは静的ファイルのみで完結するSPAなので、Vercel / GitHub Pages のどちらでも無料で公開できます。
カメラ利用にはHTTPSが必須ですが、どちらのサービスも自動でHTTPSになります。

### 方法A: Vercel（おすすめ・設定が簡単）

1. GitHubにこのプロジェクトのリポジトリを作成し、コードをpushする
2. https://vercel.com にGitHubアカウントでサインアップ
3. 「Add New Project」→ 対象リポジトリを選択
4. Framework Preset は "Vite" が自動検出される。ビルドコマンド `npm run build`、出力ディレクトリ `dist` のままでOK
5. 「Deploy」をクリックすると数十秒でHTTPSのURLが発行される
6. 以後は `git push` するたびに自動で再デプロイされる

### 方法B: GitHub Pages

1. GitHubにリポジトリを作成しpush
2. `vite.config.ts` の `base` をリポジトリ名に合わせて設定する必要があるため、ビルド時に環境変数で指定:
   ```powershell
   $env:VITE_BASE="/リポジトリ名/"; npm run build
   ```
3. `dist` フォルダの中身を `gh-pages` ブランチに公開する。簡単な方法として `gh-pages` パッケージを使う:
   ```powershell
   npm install -D gh-pages
   npx gh-pages -d dist
   ```
4. GitHubリポジトリの Settings → Pages で、公開ブランチを `gh-pages` に設定
5. `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

どちらの場合も、スマホでURLを開いたら「ホーム画面に追加」しておくとアプリのように使えます。

## データについて

- すべてのデータはブラウザのIndexedDBに保存されます。ブラウザのデータ消去・アプリ再インストール等で消える可能性があるため、
  定期的にバックアップ機能でJSONを書き出して保存してください。
- 複数端末間の同期機能はありません（各端末が独立したデータを持ちます）。
