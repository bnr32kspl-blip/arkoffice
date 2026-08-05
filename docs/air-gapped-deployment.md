# Air-gapped / restricted-network deployment

ArkOffice is intended for municipalities, hospitals, and other environments
where outbound Internet access is limited or prohibited. This guide covers
offline install, local LLM wiring, and network expectations.

## Default posture (shipping defaults)

| Capability | Default | How to enable |
| ---------- | ------- | ------------- |
| AI provider | Local OpenAI-compatible (`http://127.0.0.1:8080/v1`) | Settings UI / `ai-settings.json` |
| Web / image search | Off | `ARKOFFICE_ALLOW_WEB_SEARCH=1` |
| Auto-update checks | Off | `ARKOFFICE_AUTO_UPDATE=1` or `update-preferences.json` |
| Third-party SaaS AI account | Not required | Not part of the product path |
| `ee/` enterprise tree | Absent | Must remain absent (`npm run check:no-ee`) |

Document bytes and AI prompts stay on the endpoint (and any local or
intranet LLM you configure). They are not sent to ArkOffice or Mainfunc
servers by default.

## Prerequisites

- Windows x64 or macOS Apple Silicon (same platforms as upstream)
- Node is **not** required on end-user machines (installers embed the runtime)
- For AI: a local OpenAI-compatible server (recommended: llama.cpp `llama-server`)
- Optional: GPU drivers / sufficient RAM for the chosen GGUF model
- Sheets xlsx sidecar is bundled with the app build; no separate Rust install for end users

## Build offline installers (vendor / integrator)

On a networked build machine:

```bash
npm ci
npm run check:no-ee
npm run check:trademarks
npm run check:airgap
npm run fixtures
npm test
npm run typecheck
# unsigned local artifacts (signing is environment-specific):
npm run dist:win   # or dist:mac
```

Transfer only the resulting installer (and optional model/runtime packages)
into the closed network via approved media.

### Code signing (required for many org deployments)

Signing must use **your** organization’s certificates:

- Windows: Authenticode (EV preferred for SmartScreen)
- macOS: Developer ID Application + notarization

ArkOffice does not ship upstream vendor signing identities. Without
signing, installers still run for lab use but may be blocked by enterprise
policy.

Do **not** set `ARKOFFICE_UPDATE_URL` for closed-network builds unless you
operate an intranet update feed and also set `ARKOFFICE_AUTO_UPDATE=1`.

## Local LLM (llama.cpp)

On each workstation (or a LAN inference host reachable only inside the site):

```bash
llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080
```

In ArkOffice AI settings:

- Provider: **Local (llama.cpp)**
- Base URL: `http://127.0.0.1:8080/v1` (or `http://<intranet-host>:8080/v1`)
- Model: the id exposed by the server (often the model file stem)
- API key: leave empty unless your gateway requires one

Ollama is an acceptable fallback (`http://127.0.0.1:11434/v1`) if packaging
llama.cpp binaries is impractical.

Example settings file (copied into the app `userData` directory only by
administrators): see [`examples/ai-settings.local.example.json`](examples/ai-settings.local.example.json).

## Network allowlist

See [`network-allowlist.md`](network-allowlist.md). With all optional features
left at defaults, **no Internet destinations are required**.

## Verification

Operators should run through [`verification-checklist.md`](verification-checklist.md).

Developers / release engineers:

```bash
npm run check:airgap
```

## Data handling summary

- Office files open/save locally; engines prefer byte-preserving edits
- AI traffic goes only to the configured provider base URL
- Logs remain local (Electron / OS logs); no crash telemetry service is wired
- Fonts used for layout fidelity are bundled (see `apps/docs/src/renderer/fonts/README.md`)

## Related

- [SECURITY.md](../SECURITY.md) — process security and AI threat models
- [CONTRIBUTING.md](../CONTRIBUTING.md) — environment variables
- [README.md](../README.md) — product background and phase status
