# セキュリティポリシー

## 脆弱性の報告

疑わしい脆弱性は、公開 Issue ではなく ArkOffice メンテナーへ非公開で報告してください（連絡先はリポジトリ公開時に掲載予定）。セキュリティ報告は公開 Issue にしないでください。原則 72 時間以内に受領を返信します。

## 閉域網向けの姿勢

ArkOffice は、閉域網および制限ネットワーク（例: 自治体・医療機関の端末）を想定しています。出荷時の既定は次のとおりです。

- AI は **ローカル** の OpenAI 互換エンドポイント（`http://127.0.0.1:8080/v1`）を使用します。通常は llama.cpp の `llama-server` であり、ベンダーのクラウドアカウントではありません。
- 外向きの Web / 画像検索は、`ARKOFFICE_ALLOW_WEB_SEARCH=1` を設定しない限り **OFF** です。
- 自動更新チェックは、`ARKOFFICE_AUTO_UPDATE=1`、または `userData/update-preferences.json` で `"enabled": true` としない限り **OFF** です。
- upstream の `ee/` ツリー（Enterprise License）は本リポジトリに含まれません。

文書内容と AI プロンプトが端末外へ出るのは、管理者が設定した AI の base URL（localhost または承認済みイントラネットゲートウェイ）に限られます。詳細は [`docs/air-gapped-deployment.md`](docs/air-gapped-deployment.md) および [`docs/network-allowlist.md`](docs/network-allowlist.md) を参照してください。

## プロセスのセキュリティ姿勢

すべてのアプリケーションウィンドウで Electron レンダラのロックダウンを適用しています。

- 文書ウィンドウおよびタブビュー（docs / sheets / slides / pdf / shell / updater）すべてで `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- レンダラからメインプロセスへの到達は、型付き・検証済みの IPC チャネルのみ（ペイロードはメインプロセスでスキーマ検証。sheets は end-to-end で zod）
- `shell.openExternal` は共有ゲート（`@arkoffice/electron-utils` → `safeExternalUrl`）経由のみ。URL をパースし、プロトコル許可リスト（http/https。PDF リンク注釈では mailto も可）を強制。`file:`、`javascript:`、独自スキームは常に拒否
- API キーのハードコードなし。クラウド用キー（使用時）は OS レベル / userData の設定ストアに保持。ローカル LLM のキーは空でも可

## 脅威モデル: AI 生成レイアウトスクリプト（slides）

slides の AI は、レイアウト調整用の小さなスクリプトを出力します。これは Acorn でパースされ、制約付き AST インタプリタ（`apps/slides/src/renderer/ai/layout-script-interpreter.ts`）で評価されます。見た目はモデル互換のための小さな同期的 JavaScript サブセットですが、`eval`、`Function`、VM コンテキスト、ワーカー、あるいは JavaScript エンジンへの実行ソースとしては渡しません。

**設計上スクリプトができること:** `els` / `canvas` のプロトタイプ無し JSON コピーの読み取り、有界な算術・制御フロー、明示実装の string / array / 正規表現 / Math ヘルパー、および `setBox` / `moveBy` / `resizeBy` / `setText` / `setStyle` / `setFill` / `setStroke` / `log` の呼び出し。各編集プリミティブは引数を検証し（要素の存在、読み取り専用フラグ、有限数、16 進カラー）、手動編集と同じコマンドパイプライン経由で適用される op バッファにのみ書き込みます。

**インタプリタ境界:**

1. 識別子は、文書化されたデータと呼び出し可能オブジェクトで初期化されたインタプリタ固有のレキシカルスコープでのみ解決されます。環境グローバル、モジュールローダ、DOM、ネットワーク、IPC ブリッジ、タイマー、process API、動的コード原語はありません。
2. プロパティ読み取りは値の型でディスパッチされます。データオブジェクトは自前の JSON フィールドのみ。配列・文字列・正規表現は小さなメソッド許可リストのみ。ホストのプロトタイプや関数プロパティは、計算プロパティ名経由でも辿りません。
3. 呼び出しはインタプリタが生成した関数、または明示的な組み込みのみ。コンストラクタ／プロトタイプ鎖から得たホスト関数は表現できません。
4. 編集プリミティブに渡る入出力は、JSON ライクでプロトタイプ無しのデータとして再帰コピーされます。エラー時はバッファ済み操作をすべて破棄し、ログは上限付きです。
5. 文／式および呼び出し深さに上限があり、暴走ループや再帰を抑制します。

Electron レンダラのサンドボックスは多層防御として残りますが、レイアウトスクリプトのセキュリティ境界ではありません。インタプリタは、レイアウトスクリプトがそもそもレンダラ能力を取得できないよう設計されています。

注入されたプリミティブ以外（ネットワーク、ストレージ、設計上到達不能な IPC、メインプロセス）へレイアウトスクリプトから到達できる場合は脆弱性です。報告してください。

## 脅威モデル: AI 生成 HTML の描画（slides エクスポート）

HTML から pptx へのエクスポートパイプラインは、非表示の `BrowserWindow` で AI 生成 HTML を描画します。当該ウィンドウは敵対コンテンツとして扱い、レンダラロックダウン一式（`sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`）、preload 無し、IPC 面無しとします。メインプロセスが `executeJavaScript` のみで駆動し、ウォッチドッグタイムアウトで破棄します。

## 対象外

- 運用者が明示設定した任意のクラウド AI プロバイダは各ベンダーの運用です。問題はそのプロバイダの窓口へ報告してください。
- すでに侵害された端末、または改変済みバイナリを前提とする脆弱性。ローカル開発用の環境変数上書き（`GSK_CLI_PATH`、`XLSX_SIDECAR_PATH`、`ARKOFFICE_USER_DATA`）もこれに含みます。設定にはプロセス環境の制御が必要であり、端末上のコード実行と同等です。
- ユーザーがクリックした後、システムブラウザで開かれるハイパーリンク（OS およびプロキシポリシーの対象）。
