/** L1/L2 UI copy — ja primary, en fallback (avoids touching all shell locale packs). */
export type LlmCopy = {
  settingsTitle: string
  settingsOpen: string
  modeLabel: string
  modeLocal: string
  modeLocalHint: string
  modeRemote: string
  modeRemoteHint: string
  remoteUrlLabel: string
  remoteUrlPlaceholder: string
  remoteUrlInvalid: string
  remoteQueueNote: string
  modelsLabel: string
  modelsDirLabel: string
  modelsEmpty: string
  modelsMissing: string
  modelsReload: string
  modelsReveal: string
  modelsError: string
  backendLabel: string
  backendAuto: string
  backendCuda: string
  backendVulkan: string
  backendCpu: string
  backendDetected: string
  runtimeLabel: string
  runtimeRefresh: string
  listenLanLabel: string
  listenLanHint: string
  listenLanWarn: string
  save: string
  cancel: string
  saved: string
  saveFailed: string
  wizardTitle: string
  wizardIntro: string
  wizardNext: string
  wizardBack: string
  wizardFinish: string
  wizardSkip: string
  wizardRemoteStep: string
  wizardModelStep: string
  localNote: string
}

const JA: LlmCopy = {
  settingsTitle: 'AI 推論の設定',
  settingsOpen: 'AI 推論の設定…',
  modeLabel: '利用形態',
  modeLocal: 'この PC で推論（ローカル）',
  modeLocalHint:
    '同梱 llama-server と待ち行列プロキシを使い、既定フォルダの GGUF をロードします。',
  modeRemote: '別 PC の推論サーバを使う',
  modeRemoteHint: '同梱サーバは起動しません。OpenAI 互換の Base URL を指定してください。',
  remoteUrlLabel: 'Base URL',
  remoteUrlPlaceholder: 'http://192.168.10.20:8080/v1',
  remoteUrlInvalid: 'http:// または https:// で始まる有効な URL を入力してください。',
  remoteQueueNote:
    'サーバが混雑しているときは順番待ちになります。ArkOffice 同梱プロキシ（/arkoffice/queue）がある場合は待ち人数が表示されます。',
  modelsLabel: 'GGUF モデル',
  modelsDirLabel: 'モデルフォルダ',
  modelsEmpty:
    'フォルダに .gguf がありません。ファイルを配置してから「再読込」を押してください。',
  modelsMissing: '前回選んだモデルが見つからないため、先頭のモデルに切り替えました。',
  modelsReload: '再読込',
  modelsReveal: 'フォルダを開く',
  modelsError: 'モデルフォルダを作成・読み取りできませんでした。権限を確認してください。',
  backendLabel: '推論バックエンド',
  backendAuto: '自動（CUDA → Vulkan → CPU）',
  backendCuda: 'CUDA',
  backendVulkan: 'Vulkan',
  backendCpu: 'CPU',
  backendDetected: '検出: {v}',
  runtimeLabel: 'ランタイム状態',
  runtimeRefresh: '再起動',
  listenLanLabel: '同一 LAN の他端末からの接続を許可する',
  listenLanHint:
    'オンにすると待ち行列プロキシが 0.0.0.0 で待受します（llama-server 自体は loopback）。推論サーバ機でのみ有効にしてください。',
  listenLanWarn:
    'LAN 公開時は Windows ファイアウォールで当該ポート（既定 8080）の受信を許可し、信頼できる拠点網に限定してください。認証は任意です。',
  save: '保存',
  cancel: 'キャンセル',
  saved: '保存しました',
  saveFailed: '保存に失敗しました',
  wizardTitle: 'AI 推論のセットアップ',
  wizardIntro:
    'この PC で推論するか、同一 LAN 上の高性能 PC を推論サーバにするかを選びます。あとから設定画面でも変更できます。',
  wizardNext: '次へ',
  wizardBack: '戻る',
  wizardFinish: '完了',
  wizardSkip: 'あとで設定する',
  wizardRemoteStep: '推論サーバの Base URL を入力してください。',
  wizardModelStep: '使用する GGUF モデルを選んでください（未配置でも完了できます）。',
  localNote: 'ローカルモードでは Base URL は http://127.0.0.1:8080/v1 に固定されます。',
}

const EN: LlmCopy = {
  settingsTitle: 'AI inference settings',
  settingsOpen: 'AI inference settings…',
  modeLabel: 'Mode',
  modeLocal: 'Run inference on this PC (local)',
  modeLocalHint:
    'Uses the bundled llama-server and queue proxy with GGUF files in the default models folder.',
  modeRemote: 'Use an inference server on another PC',
  modeRemoteHint: 'Does not start the bundled server. Enter an OpenAI-compatible Base URL.',
  remoteUrlLabel: 'Base URL',
  remoteUrlPlaceholder: 'http://192.168.10.20:8080/v1',
  remoteUrlInvalid: 'Enter a valid http:// or https:// URL.',
  remoteQueueNote:
    'When the server is busy you may wait in line. If the host runs the ArkOffice queue proxy (/arkoffice/queue), wait count is shown in the AI panel.',
  modelsLabel: 'GGUF models',
  modelsDirLabel: 'Models folder',
  modelsEmpty: 'No .gguf files found. Place models in the folder, then click Reload.',
  modelsMissing: 'The previously selected model is missing; fell back to the first model.',
  modelsReload: 'Reload',
  modelsReveal: 'Open folder',
  modelsError: 'Could not create or read the models folder. Check permissions.',
  backendLabel: 'Inference backend',
  backendAuto: 'Auto (CUDA → Vulkan → CPU)',
  backendCuda: 'CUDA',
  backendVulkan: 'Vulkan',
  backendCpu: 'CPU',
  backendDetected: 'Detected: {v}',
  runtimeLabel: 'Runtime status',
  runtimeRefresh: 'Restart',
  listenLanLabel: 'Allow connections from other PCs on the same LAN',
  listenLanHint:
    'When on, the queue proxy listens on 0.0.0.0 (llama-server stays on loopback). Enable only on the inference host.',
  listenLanWarn:
    'For LAN listen, allow the port (default 8080) in Windows Firewall and keep it on a trusted site network. API auth remains optional.',
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Saved',
  saveFailed: 'Could not save settings',
  wizardTitle: 'Set up AI inference',
  wizardIntro:
    'Choose whether this PC runs inference locally or connects to a high-spec PC on the LAN. You can change this later in settings.',
  wizardNext: 'Next',
  wizardBack: 'Back',
  wizardFinish: 'Finish',
  wizardSkip: 'Set up later',
  wizardRemoteStep: 'Enter the inference server Base URL.',
  wizardModelStep: 'Choose a GGUF model (you can finish even if none are present yet).',
  localNote: 'In local mode the Base URL is fixed to http://127.0.0.1:8080/v1.',
}

export function llmCopyForLang(lang: string): LlmCopy {
  return lang === 'ja' ? JA : EN
}

export function formatGgufSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
