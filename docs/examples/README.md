# 設定ファイルの例

本ディレクトリの JSON は、管理者がアプリの `userData` に配置する際の見本です。キー名はアプリ実装に合わせて英語のままです。値とコメント方針のみ組織ポリシーに合わせて調整してください。

| ファイル | 用途 |
| -------- | ---- |
| [`ai-settings.local.example.json`](ai-settings.local.example.json) | ローカル LLM（llama.cpp 等）向け AI 設定の例 |
| [`update-preferences.disabled.json`](update-preferences.disabled.json) | 自動更新を明示的に無効化した設定の例 |

配置先や手順の詳細は [`../air-gapped-deployment.md`](../air-gapped-deployment.md) を参照してください。
