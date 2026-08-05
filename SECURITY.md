# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to the ArkOffice maintainers
(security contact will be published with the public repository). Do not open
public issues for security reports. We aim to acknowledge reports within 72 hours.

## Closed-network posture

ArkOffice targets air-gapped and restricted networks (for example municipal and
hospital endpoints). Shipping defaults:

- AI uses a **local** OpenAI-compatible endpoint (`http://127.0.0.1:8080/v1`) —
  typically llama.cpp `llama-server` — not a vendor cloud account.
- Outbound web/image search is **off** unless `ARKOFFICE_ALLOW_WEB_SEARCH=1`.
- Auto-update checks are **off** unless `ARKOFFICE_AUTO_UPDATE=1` or
  `userData/update-preferences.json` sets `"enabled": true`.
- The upstream `ee/` tree (Enterprise License) is not present in this repository.

Document content and AI prompts leave the machine only toward the AI base URL
the administrator configures (localhost or an approved intranet gateway). See
[`docs/air-gapped-deployment.md`](docs/air-gapped-deployment.md) and
[`docs/network-allowlist.md`](docs/network-allowlist.md).

## Process Security Posture

All application windows run with the full Electron renderer lockdown:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for every
  document window and tab view (docs, sheets, slides, pdf, shell, updater).
- Renderers reach the main process only through typed, validated IPC channels
  (payloads are schema-checked in the main process; sheets uses zod end to end).
- Every `shell.openExternal` call goes through a single shared gate
  (`@arkoffice/electron-utils` → `safeExternalUrl`) that parses the URL and
  enforces a protocol allowlist (http/https; pdf link annotations additionally
  allow mailto). `file:`, `javascript:`, and custom schemes are always rejected.
- No API keys are hardcoded. Cloud provider keys, when used, stay in the
  OS-level / userData settings store. Local LLM keys may be empty.

## Threat Model: AI-Generated Layout Scripts (slides)

The slides AI can adjust slide layouts by emitting a small script that is
parsed with Acorn and evaluated by a constrained AST interpreter
(`apps/slides/src/renderer/ai/layout-script-interpreter.ts`). The source looks
like a small, synchronous subset of JavaScript for model compatibility, but it
is not passed to `eval`, `Function`, a VM context, a worker, or the JavaScript
engine as executable source.

**What the script can do by design:** read prototype-free JSON copies of
`els`/`canvas`, perform bounded arithmetic/control flow, use explicitly
implemented string/array/regular-expression/Math helpers, and call
`setBox/moveBy/resizeBy/setText/setStyle/setFill/setStroke/log`. Every edit
primitive validates its arguments (element existence, read-only flags, finite
numbers, hex colors) and writes only into an op buffer that is applied through
the same command pipeline as manual edits.

**Interpreter boundary:**

1. Identifiers resolve only in interpreter-owned lexical scopes seeded with the
   documented data and callables. There are no ambient globals, module loader,
   DOM, network, IPC bridge, timers, process APIs, or dynamic code primitives.
2. Property reads are dispatched by value type. Data objects expose own JSON
   fields only; arrays, strings, and regexes expose a small method allowlist.
   Host prototypes and function properties are never traversed, including
   through computed property names.
3. Calls accept only interpreter-created functions or explicit builtins. A host
   function obtained through a constructor/prototype chain cannot be
   represented.
4. Inputs and values crossing into edit primitives are recursively copied as
   JSON-like, prototype-free data. Errors discard all buffered operations;
   logs are capped.
5. Execution has statement/expression and call-depth limits to bound runaway
   loops or recursion.

The Electron renderer sandbox remains defense in depth, but it is not the
layout-script security boundary. The interpreter is designed so a layout
script cannot obtain renderer capabilities in the first place.

If you find a way for a layout script to reach anything beyond the injected
primitives (network, storage, IPC channels not reachable by design, or the
main process), that is a vulnerability — please report it.

## Threat Model: Rendering AI-Generated HTML (slides export)

The HTML-to-pptx export pipeline renders AI-generated HTML in a hidden
`BrowserWindow`. That window is treated as hostile content: full renderer
lockdown (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`),
no preload script, no IPC surface — the main process drives it exclusively
through `executeJavaScript` and destroys it under a watchdog timeout.

## Out of Scope

- Optional cloud AI providers the operator explicitly configures are operated
  by those vendors; issues with them should be reported through the provider's
  channels.
- Vulnerabilities that require an already-compromised machine or a modified
  binary. This includes deliberate environment-variable override points for
  local development (`GSK_CLI_PATH`, `XLSX_SIDECAR_PATH`,
  `ARKOFFICE_USER_DATA`): setting them requires control of the process
  environment, which is equivalent to code execution on the machine.
- Hyperlinks opened in the system browser after a user click (subject to OS and
  proxy policy).
