# Mermaid to Image

Mermaid 記法のコードを入力すると、その場でプレビューし、PNG / SVG としてダウンロードできる Web アプリです。
すべてブラウザの中で動き、入力したコードがサーバーに送られることはありません。

## 使い方

```sh
npm install
npm run dev        # 開発サーバーを起動
npm test           # 単体テスト（Vitest）
npm run test:e2e   # E2E テスト（Playwright。ビルドしてから実行）
npm run build      # 型チェックと本番ビルド（dist/ に静的ファイルを出力）
```

## 書き出し

- PNG: 白背景、2 倍の解像度（長辺が 8192px を超える場合は 8192px に収まるよう縮小）。ファイル名は `diagram.png`。
- SVG: ファイル名は `diagram.svg`。
