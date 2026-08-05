# 同梱 llama-server（Windows x64）

次のファイル名で配置してください（ビルド／リリース時に `resources/llm` へ同梱されます。`electron-builder.cjs` の `optionalLlmResources`）。

| ファイル | バックエンド |
| -------- | ----------- |
| `llama-server-cuda.exe` | CUDA（NVIDIA dGPU） |
| `llama-server-vulkan.exe` | Vulkan（iGPU 等） |
| `llama-server-cpu.exe` | CPU |

付随 DLL がある場合は同じディレクトリに置きます。

## 入手方法（例）

1. [llama.cpp Releases](https://github.com/ggml-org/llama.cpp/releases) から Windows 向けビルドを取得する  
2. 上記のファイル名にリネームして本ディレクトリへコピーする  
3. 開発時: `ARKOFFICE_LLM_DIR` で別パスを指定してもよい  

CUDA 版は対象 PC に NVIDIA ドライバが必要です。バイナリはリポジトリにコミットしません（容量・ライセンス）。

## 検証

```text
apps/shell/vendor/llm/
  llama-server-cpu.exe
  (optional) llama-server-vulkan.exe
  (optional) llama-server-cuda.exe
```

1. ArkOffice をローカルモードで起動し、「AI 推論の設定」でランタイム状態が `running` になること  
2. `http://127.0.0.1:8080/v1/models` が 200 を返すこと（待ち行列プロキシ経由）  
3. `http://127.0.0.1:8080/arkoffice/queue` が JSON（`waiting` / `active`）を返すこと  
4. パッケージ後は `resources/llm/` に exe が含まれること（`vendor/llm` 未配置のビルドでは空になる）

詳細: [`docs/local-llm-runtime.md`](../../../docs/local-llm-runtime.md)、[`docs/verification-checklist.md`](../../../docs/verification-checklist.md)
