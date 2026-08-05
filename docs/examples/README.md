# 設定ファイルの例

本ディレクトリの JSON は、管理者がアプリの `userData` に配置する際の見本です。キー名はアプリ実装に合わせて英語のままです。値とコメント方針のみ組織ポリシーに合わせて調整してください。

| ファイル | 用途 |
| -------- | ---- |
| [`ai-settings.local.example.json`](ai-settings.local.example.json) | ローカルモードの AI 設定例 |
| [`ai-settings.remote.example.json`](ai-settings.remote.example.json) | リモート推論サーバ向け AI 設定例 |
| [`ai-settings.listen-lan.example.json`](ai-settings.listen-lan.example.json) | 推論ホストで LAN 公開（`listenLan: true`）する例 |
| [`update-preferences.disabled.json`](update-preferences.disabled.json) | 自動更新を明示的に無効化した設定の例 |

配置先や手順の詳細は [`../air-gapped-deployment.md`](../air-gapped-deployment.md) を参照してください。受け入れ確認は [`../verification-checklist.md`](../verification-checklist.md) です。
