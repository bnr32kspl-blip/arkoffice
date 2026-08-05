# Network allowlist

Destinations ArkOffice may contact, depending on configuration.

## Default (closed network)

No outbound Internet hosts are required.

| Destination | Purpose | When |
| ----------- | ------- | ---- |
| `127.0.0.1` / localhost | Local llama.cpp / Ollama / other OpenAI-compatible server | AI enabled (default provider) |
| Intranet host you configure as AI `baseUrl` | Site-local inference gateway | If AI is not on localhost |
| *(none)* | Auto-update | Default off |
| *(none)* | Web / image search | Default off |

## Optional features (explicit enablement only)

| Destination | Purpose | Enablement |
| ----------- | ------- | ---------- |
| Update feed host from `ARKOFFICE_UPDATE_URL` / `app-update.yml` | Installer metadata + packages | `ARKOFFICE_AUTO_UPDATE=1` **and** a feed URL present |
| `https://api.openai.com` | OpenAI cloud models | User selects OpenAI provider + API key |
| `https://api.anthropic.com` | Claude | User selects Anthropic provider + API key |
| Google Gemini API hosts | Gemini | User selects Gemini provider + API key |
| `https://api.deepseek.com` | DeepSeek | User selects DeepSeek provider + API key |
| Custom `baseUrl` | Any OpenAI-compatible cloud/intranet gateway | User selects Custom / Local with that URL |
| `https://google.serper.dev` | Serper web/image search | `ARKOFFICE_ALLOW_WEB_SEARCH=1` **and** `SERPER_API_KEY` |
| DuckDuckGo HTML endpoints | Search fallback | `ARKOFFICE_ALLOW_WEB_SEARCH=1` |
| Optional `@genspark/cli` upstream hosts | Legacy optional tooling | Only if the optional package is installed and used |

## Firewall guidance for municipalities / hospitals

1. Deny outbound by default on clinical / office endpoints.
2. Allow only the local or intranet LLM base URL (TCP to that host:port).
3. Do not open update or search destinations unless a formal change request
   enables those features.
4. Treat document paths and AI prompts as sensitive data; keep inference
   on-prem.

## Notes

- `shell.openExternal` is gated to `http:` / `https:` (and `mailto:` for some
  PDF links). Opening a hyperlink in a document can still reach the public
  Internet **if the OS browser and network policy allow it** — that is outside
  the AI stack. Harden via OS / proxy policy as needed.
- Sheets may call Chromium `resolveProxy` against a synthetic URL
  (`https://arkoffice.local`) to discover system proxy settings. That is a
  proxy-resolution query, not an ArkOffice cloud API call.
