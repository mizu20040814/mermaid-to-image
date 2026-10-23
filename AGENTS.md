# AGENTS.md

ブラウザだけで動く Mermaid エディタ（Vite + TypeScript、フレームワークなし）。Mermaid のコードをプレビューし、PNG / SVG でダウンロードできる。

- 仕様: `docs/superpowers/specs/2026-10-23-mermaid-web-editor-design.md`
- 単体テスト: `npm test`（Vitest）
- E2E テスト: `npm run test:e2e`（Playwright。ビルドしてから実行する）
- ビルド: `npm run build`

## Review guidelines

- レビューのコメント・要約・提案は、すべて日本語で書くこと。コード、識別子、コマンド、エラーメッセージの引用は原文のままでよい。
- 指摘には、問題が起きる具体的な入力や手順と、期待される挙動を書くこと。
- 仕様（上記ファイル）と食い違う挙動は優先して指摘すること。特に、表示中の図とエディタのコードが食い違う状態で書き出せてしまうものは重大として扱う。
