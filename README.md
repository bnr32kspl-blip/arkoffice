# ArkOffice

自治体・病院など、インターネット接続が制限された環境向けの AI ネイティブ Office スイートです。

[genspark-ai/genoffice](https://github.com/genspark-ai/genoffice)（Apache License 2.0）をベースにフォークし、商標の分離・エンタープライズディレクトリ除外・ローカル LLM 前提の改修を行います。

> **実装状況:** Phase 1–4 完了。次は Phase 5（閉域検証・署名配布）。  
> 進捗の可視化は Cursor Canvas「ArkOffice 実装状況」と、下表「実装結果」を更新していきます。

---

## 経緯

### なぜフォークするか

upstream の GenOffice は優秀なオープンソース AI Office ですが、次の点が本プロジェクトの想定利用者と合いません。

1. **AI が Genspark クラウド前提**（アカウント・クレジット・外部 API）
2. **製品名・ロゴが Mainfunc, Inc. の商標**（商用配布には独自ブランドが必須）
3. **`ee/` が別ライセンス**（GenOffice Enterprise License。本番・配布には使えない）

想定エンドユーザーは自治体・医療機関など、**閉域網・プロキシ制限・外部送信禁止**が前提の組織です。文書データを外部 LLM に送れないケースが標準です。

そのため ArkOffice では次を方針とします。

| 方針 | 内容 |
|------|------|
| ブランド | **ArkOffice**（GenOffice / Genspark 商標は使用しない） |
| ライセンス境界 | upstream の **`ee/` は含めない**（履歴からも除去） |
| AI 既定 | **ローカル推論（llama.cpp 優先）** |
| クラウド AI | **残す**（OpenAI 互換 API。管理者が明示した場合のみ） |
| オートアップデート | **機能は残し、デフォルト OFF** |
| 帰属 | Apache-2.0 の `LICENSE` / `NOTICE` は維持 |

### upstream との関係

- 本体コード: Apache License 2.0（商用利用・改変可）
- `ee/`: GenOffice Enterprise License → **本リポジトリには置かない**
- 商標: GenOffice / Genspark 名称・ロゴは Mainfunc, Inc. のもの → **使用しない**
- upstream は private tree の mirror（snapshot sync）運用。ArkOffice は独自リポジトリを正とする

---

## 製品方針（確定）

### ブランド

| 項目 | 値 |
|------|-----|
| 製品名 | ArkOffice |
| npm スコープ | `@arkoffice/*` |
| Electron appId | `com.arkoffice.app`（予定） |
| 環境変数接頭辞 | `ARKOFFICE_*`（予定） |

### AI プロバイダ

```
優先順位（製品としての推奨）
1. ローカル: llama.cpp（llama-server の OpenAI 互換 API）
2. フォールバック運用: Ollama 等（同じく OpenAI 互換）※ llama.cpp 同梱が困難な場合
3. クラウド: OpenAI 互換エンドポイント（Azure OpenAI / その他互換ゲートウェイ含む）
```

- **既定:** ローカル（例: `http://127.0.0.1:8080/v1`）
- **クラウドは残す:** 設定 UI から OpenAI 互換で接続可能にする（閉域では使わなければよい）
- **Genspark 専用経路・gsk ログイン依存は製品パスから外す**（商標・閉域の両面）

llama.cpp の採用理由: ランタイムを施設内で完結させやすく、GGUF モデル配布・バージョン固定・監査説明がしやすい。実装コスト（マルチアーキ GPU バイナリ同梱など）が高すぎる場合は、**外部の llama-server / Ollama に接続する方式**に落とす。

### ネットワーク・更新

| 機能 | 既定 | 備考 |
|------|------|------|
| ローカル LLM | ON（要ローカルサーバ） | 外向きフォールバックなし |
| クラウド AI | 設定で選択可 | OpenAI 互換 |
| Web 検索など外向きツール | OFF | 閉域では無効のまま |
| オートアップデート | **OFF** | `ARKOFFICE_AUTO_UPDATE=1` または update-preferences.json で有効化 |

---

## 実装計画（要約）

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | `ee/` 完全除外（削除・履歴除去・CI ガード） | **完了** |
| 2 | ArkOffice リブランディング（名称・アイコン・appId・商標スキャン） | **完了** |
| 3 | ローカル LLM 既定化（llama.cpp / OpenAI 互換）+ Genspark 依存除去。クラウド OpenAI 互換は維持 | **完了** |
| 4 | オートアップデート既定 OFF | **完了** |
| 5 | 閉域検証・署名付き配布・運用手順 | 未着手 |

---

## 実装結果

### 2026-08-05 — Phase 4

- shell / docs の自動更新チェックを **既定 OFF**
- 有効化: `ARKOFFICE_AUTO_UPDATE=1`、または `userData/update-preferences.json` の `{ "enabled": true }`
- 機能コード（electron-updater）は残置。`ARKOFFICE_FAKE_UPDATE` による UI プレビューも維持
- updater ユニットテスト更新・通過

### 2026-08-05 — Phase 3

- AI 既定プロバイダを **local（llama.cpp / OpenAI 互換、`http://127.0.0.1:8080/v1`）** に変更
- Genspark プロバイダと製品パス上の強制ログインを除去（クラウドは OpenAI / Claude / Gemini / DeepSeek / Custom を維持）
- Web/画像検索は **既定 OFF**（`ARKOFFICE_ALLOW_WEB_SEARCH=1` で有効化）
- `@genspark/cli` を optionalDependencies 化し、electron-builder 同梱も存在時のみ
- `ai-provider` / `ai-search` / `agent-core` テスト通過

### 2026-08-05 — Phase 2

- 製品識別子を **ArkOffice** に置換（`@arkoffice/*`、`com.arkoffice.app`、`ARKOFFICE_*`、`productName`）
- シェルアプリアイコン（`icon.png` / `icon-mac.png` / `icon.ico` / `icon.icns`）を新規デザインで置換
- `NOTICE` は Apache 帰属を維持しつつ製品名を ArkOffice（derived from GenOffice）に更新
- `npm run check:trademarks` と CI `license-boundary` に商標ゲートを追加

### 2026-08-05 — Phase 1

- upstream `genspark-ai/genoffice` を取り込み
- **`ee/` ディレクトリを削除**（Enterprise License を製品ツリーから排除）
- README / CONTRIBUTING / CODEOWNERS から `ee/` 参照を除去・更新
- **履歴を orphan コミットで再初期化**し、過去コミットに `ee/` を残さない
- 再混入防止: `tools/check-no-ee.mjs`、`npm run check:no-ee`、CI `license-boundary` ジョブ、`.gitignore` に `/ee/`
- 経緯・方針ドキュメントを本 README に集約
- 実装状況 Canvas を作成

### 2026-08-05 — 方針確定

- 商用フォーク方針を確定（ArkOffice / `ee/` 削除 / 閉域・ローカル LLM / 更新デフォルト OFF）
- 推論エンジンは **llama.cpp 優先**、困難時は Ollama 可
- クラウド AI は **OpenAI 互換 API として残す**
- Implementation Plan のリポジトリ書き出しは行わず、経緯と結果は本 README に集約

---

## ライセンス・帰属

本プロジェクトのオープンソース由来部分は [Apache License 2.0](LICENSE) に従います。ルートの `LICENSE` と `NOTICE` を参照してください。

upstream 由来の著作権表示（Mainfunc, Inc. / GenOffice の NOTICE 等）はライセンス義務として維持します。  
**製品名・ロゴとしての GenOffice / Genspark は使用しません。**

`ee/`（GenOffice Enterprise License）は本リポジトリに含まれません。確認コマンド:

```bash
npm run check:no-ee
npm run check:trademarks
```

ローカル LLM（例）:

```bash
llama-server -m model.gguf --port 8080
# ArkOffice Settings → Local (llama.cpp) → Base URL http://127.0.0.1:8080/v1 + model id
```

オートアップデートを有効にする場合（閉域では通常不要）:

```bash
# 環境変数
set ARKOFFICE_AUTO_UPDATE=1

# または userData/update-preferences.json
# { "enabled": true }
```

---

## 開発

```bash
npm install
npm run check:no-ee
npm run fixtures
npm test
npm run typecheck
npm run dev
```

Sheets の xlsx sidecar には Rust ツールチェーンが必要です。ローカル LLM には別途 llama.cpp（`llama-server`）または互換ランタイムが必要です（Phase 3 で既定化予定）。
