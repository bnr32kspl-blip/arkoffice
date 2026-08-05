# 閉域網・制限ネットワーク向け展開手順

ArkOffice は、自治体・医療機関など、インターネットへの外向き通信が制限または禁止されている環境向けです。本手順ではオフラインインストール、ローカル LLM の接続、ネットワーク上の前提を説明します。

## 出荷時の既定動作

| 機能 | 既定 | 有効化方法 |
| ---- | ---- | ---------- |
| AI プロバイダ | ローカル（OpenAI 互換、`http://127.0.0.1:8080/v1`） | 設定 UI / `ai-settings.json` |
| Web / 画像検索 | OFF | `ARKOFFICE_ALLOW_WEB_SEARCH=1` |
| 自動更新チェック | OFF | `ARKOFFICE_AUTO_UPDATE=1` または `update-preferences.json` |
| 第三者 SaaS の AI アカウント | 不要 | 製品パスに含まれない |
| `ee/` エンタープライズツリー | 無し | 常に無しを維持（`npm run check:no-ee`） |

文書データと AI へのプロンプトは、端末上（および管理者が設定したローカル／イントラネット LLM）に留まります。既定では ArkOffice や Mainfunc のサーバへ送信しません。

## 前提条件

- Windows x64 または macOS Apple Silicon（upstream と同じ対象プラットフォーム）
- エンドユーザー端末に Node は**不要**（インストーラにランタイム同梱）
- AI 利用時: ローカルの OpenAI 互換サーバ（推奨: llama.cpp の `llama-server`）
- 任意: 利用する GGUF モデルに応じた GPU ドライバ / 十分なメモリ
- Sheets の xlsx サイドカーはアプリビルドに同梱。エンドユーザー向けの別途 Rust インストールは不要

## オフライン用インストーラのビルド（ベンダー／インテグレータ）

ネットワーク接続可能なビルド機で:

```bash
npm ci
npm run check:no-ee
npm run check:trademarks
npm run check:airgap
npm run fixtures
npm test
npm run typecheck
# 未署名のローカル成果物（署名は環境依存）:
npm run dist:win   # または dist:mac
```

生成されたインストーラ（および必要ならモデル／ランタイム一式）のみを、承認済み媒体経由で閉域網へ持ち込んでください。

### コード署名（多くの組織展開で必須）

署名には**貴組織の証明書**を使用します。

- Windows: Authenticode（SmartScreen 対策として EV 推奨）
- macOS: Developer ID Application + 公証（notarization）

ArkOffice に upstream ベンダーの署名身分は同梱しません。未署名でも検証用途では起動できますが、組織ポリシーでブロックされることがあります。

閉域向けビルドでは、イントラネット更新フィードを自前運用し、かつ `ARKOFFICE_AUTO_UPDATE=1` を設定する場合を除き、`ARKOFFICE_UPDATE_URL` を設定しないでください。

## ローカル LLM（llama.cpp）

各端末（または拠点内 LAN のみ到達可能な推論ホスト）で:

```bash
llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080
```

ArkOffice の AI 設定:

- プロバイダ: **Local (llama.cpp)**
- Base URL: `http://127.0.0.1:8080/v1`（または `http://<イントラネットホスト>:8080/v1`）
- モデル: サーバが公開する ID（多くの場合モデルファイル名のステム）
- API キー: ゲートウェイが要求しない限り空欄

llama.cpp バイナリの同梱が難しい場合は、Ollama（`http://127.0.0.1:11434/v1`）を代替として利用できます。

設定ファイルの例（管理者がアプリの `userData` に配置する場合のみ）: [`examples/ai-settings.local.example.json`](examples/ai-settings.local.example.json)

## ネットワーク許可リスト

[`network-allowlist.md`](network-allowlist.md) を参照してください。任意機能をすべて既定のままにすれば、**インターネット上の到達先は不要**です。

## 検証

運用担当者は [`verification-checklist.md`](verification-checklist.md) に沿って確認してください。

開発者／リリース担当:

```bash
npm run check:airgap
```

## データの扱い（要約）

- Office ファイルの開閉・保存はローカル。エンジンはバイト保持の編集を優先
- AI 通信は設定されたプロバイダの base URL のみ
- ログは端末内（Electron / OS ログ）。クラッシュテレメトリサービスは未接続
- レイアウト再現用フォントは同梱（`apps/docs/src/renderer/fonts/README.md` 参照）

## 関連ドキュメント

- [SECURITY.md](../SECURITY.md) — プロセスセキュリティと AI の脅威モデル
- [CONTRIBUTING.md](../CONTRIBUTING.md) — 環境変数（開発者向け・英語）
- [README.md](../README.md) — 製品経緯と実装状況
