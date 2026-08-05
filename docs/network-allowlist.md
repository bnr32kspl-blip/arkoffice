# ネットワーク許可リスト

設定内容に応じて ArkOffice が接続しうる到達先です。

## 既定（閉域網）

インターネット上の外向きホストは不要です。

| 到達先 | 用途 | 条件 |
| ------ | ---- | ---- |
| `127.0.0.1` / localhost | ローカル llama.cpp / Ollama / その他 OpenAI 互換サーバ | AI 利用時（既定プロバイダ） |
| AI の `baseUrl` に設定したイントラネットホスト | 拠点内推論ゲートウェイ | AI を localhost 以外に置く場合 |
| （なし） | 自動更新 | 既定 OFF |
| （なし） | Web / 画像検索 | 既定 OFF |

## 任意機能（明示的な有効化時のみ）

| 到達先 | 用途 | 有効化条件 |
| ------ | ---- | ---------- |
| `ARKOFFICE_UPDATE_URL` / `app-update.yml` で指定した更新フィード | インストーラメタデータとパッケージ | `ARKOFFICE_AUTO_UPDATE=1` **かつ** フィード URL の設定 |
| `https://api.openai.com` | OpenAI クラウドモデル | ユーザーが OpenAI プロバイダと API キーを選択 |
| `https://api.anthropic.com` | Claude | ユーザーが Anthropic プロバイダと API キーを選択 |
| Google Gemini API ホスト | Gemini | ユーザーが Gemini プロバイダと API キーを選択 |
| `https://api.deepseek.com` | DeepSeek | ユーザーが DeepSeek プロバイダと API キーを選択 |
| 任意の `baseUrl` | OpenAI 互換のクラウド／イントラゲートウェイ | Custom / Local で当該 URL を指定 |
| `https://google.serper.dev` | Serper による Web / 画像検索 | `ARKOFFICE_ALLOW_WEB_SEARCH=1` **かつ** `SERPER_API_KEY` |
| DuckDuckGo HTML エンドポイント | 検索フォールバック | `ARKOFFICE_ALLOW_WEB_SEARCH=1` |
| 任意の `@genspark/cli` が参照する upstream ホスト | レガシー任意ツール | 当該 optional パッケージを導入・利用した場合のみ |

## 推論ホストの受信（任意）

推論サーバ機で `listenLan` を有効にした場合のみ、他端末からの **受信** が発生します。

| 待受 | 条件 |
| ---- | ---- |
| `127.0.0.1:<port>` | 既定（LAN オプトイン OFF） |
| `0.0.0.0:<port>` | 「同一 LAN の他端末からの接続を許可」ON、または `ARKOFFICE_LLM_LISTEN_LAN=1` |

クライアント側の到達先は、当該ホストのプライベート IP（例: `http://192.168.x.x:8080/v1`）です。インターネット向けに開けないでください。

## 自治体・医療機関向けファイアウォール指針

1. 診療・事務端末は、外向き通信を原則拒否とする。
2. 許可するのはローカルまたはイントラネットの LLM base URL（当該ホスト:ポートへの TCP）のみ。
3. 推論ホストで LAN 公開する場合は、**受信**を拠点内セグメントに限定し、インターネットからの到達を禁止する。
4. 更新や検索の到達先は、正式な変更申請で機能を有効化するまで開けない。
5. 文書パスと AI プロンプトは機微情報として扱い、推論はオンプレミスに閉じる。

## 補足

- `shell.openExternal` は `http:` / `https:`（一部 PDF リンクでは `mailto:` も）に制限されます。文書内ハイパーリンクを開くと、**OS のブラウザとネットワークポリシーが許せば** 公衆インターネットに到達し得ます。これは AI スタック外の経路です。必要に応じて OS / プロキシで制御してください。
- Sheets はシステムプロキシ検出のため、合成 URL（`https://arkoffice.local`）に対して Chromium の `resolveProxy` を呼びます。これはプロキシ解決のための問い合わせであり、ArkOffice クラウド API への通信ではありません。
