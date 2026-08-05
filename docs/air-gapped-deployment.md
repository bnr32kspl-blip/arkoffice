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

## 同梱 llama-server（Windows）

リリース／開発ビルドでは、次を `apps/shell/vendor/llm/` に置くとインストーラの `resources/llm` に同梱されます（詳細は同ディレクトリの README）。

- `llama-server-cuda.exe` / `llama-server-vulkan.exe` / `llama-server-cpu.exe`

**ローカルモード**起動時、ArkOffice が次を行います。

1. 同梱 `llama-server` を loopback の内部ポート（公開ポート + 10000）で起動（`-np 1`）
2. 公開ポート（既定 8080）に待ち行列プロキシを立て、OpenAI 互換 API と `GET /arkoffice/queue` を提供
3. アプリ終了時に子プロセスとプロキシを停止

リモートモードでは同梱サーバ・プロキシは起動しません。上書きパス: `ARKOFFICE_LLM_DIR`。

## 推論ホストとして LAN 公開する場合

推論用 PC でローカルモードを使い、「AI 推論の設定」で **同一 LAN の他端末からの接続を許可する** をオンにします（`listenLan: true`）。待ち行列プロキシが `0.0.0.0:8080`（既定ポート）で待受し、背後の llama-server は loopback のみです。

1. Windows ファイアウォールで **受信** TCP 8080（または設定したポート）を、拠点内セグメントからのみ許可する  
2. 他端末はリモートモードで Base URL を `http://<推論ホストのLAN IP>:8080/v1` にする  
3. オプトイン OFF（既定）では `127.0.0.1` のみ待受のため、他端末からは接続できない  
4. 管理者上書き: 環境変数 `ARKOFFICE_LLM_LISTEN_LAN=1`  
5. 混雑時は AI パネルに順番待ちが表示される（プロキシ経由）

## ローカル LLM（モデル配置）

モデルファイル（`.gguf`）はアプリに同梱しません。Windows では次のフォルダに配置します。

```
%ProgramData%\ArkOffice\models
```

（例: `C:\ProgramData\ArkOffice\models`）。サブフォルダは 1 階層まで検索されます。上書きは環境変数 `ARKOFFICE_MODELS_DIR`。アプリの「AI 推論の設定」からフォルダを開けます。

### 同梱ランタイムを使う場合（推奨）

初回ウィザードまたは「AI 推論の設定」で **この PC で推論** を選び、モデルを選択するだけで利用できます。Base URL は自動で `http://127.0.0.1:8080/v1` になります。

### 外部の llama-server / Ollama を使う場合

同梱バイナリを置かない展開では、各端末（または拠点内の推論ホスト）で手動起動します。

```bash
llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080 -np 1
```

ArkOffice の AI 設定:

- プロバイダ: **Local (llama.cpp)** またはリモートモードで Base URL 指定
- Base URL: `http://127.0.0.1:8080/v1`（または `http://<イントラネットホスト>:8080/v1`）
- モデル: サーバが公開する ID（多くの場合モデルファイル名のステム）
- API キー: ゲートウェイが要求しない限り空欄

Ollama（`http://127.0.0.1:11434/v1`）も代替として利用できます。外部サーバに待ち行列プロキシが無い場合、順番待ち UI は出ないことがあります。

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

- [ローカル LLM ランタイム仕様](local-llm-runtime.md) — 同梱 llama-server・GGUF 配置・リモート推論・GPU 選択
- [SECURITY.md](../SECURITY.md) — プロセスセキュリティと AI の脅威モデル
- [CONTRIBUTING.md](../CONTRIBUTING.md) — 環境変数（開発者向け・英語）
- [README.md](../README.md) — 製品経緯と実装状況
