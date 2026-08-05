# Closed-network verification checklist

Use this before handing ArkOffice to a municipality / hospital pilot.

## Build / license boundary

- [ ] `npm run check:no-ee` passes (no `ee/` tree)
- [ ] `npm run check:trademarks` passes
- [ ] `npm run check:airgap` passes
- [ ] Root `LICENSE` is Apache-2.0; `NOTICE` retains upstream attribution
- [ ] Installer product name / About UI shows **ArkOffice** only (no upstream product branding)

## Offline install

- [ ] Installer transferred via approved offline media (no CDN fetch at install time)
- [ ] App launches with network adapter disabled or firewall deny-outbound
- [ ] Docs / Sheets / Slides / PDF open and save sample files without network
- [ ] Bundled fonts render without downloading fonts from the Internet

## AI (local)

- [ ] `llama-server` (or approved intranet OpenAI-compatible endpoint) is running
- [ ] AI settings provider is **Local (llama.cpp)** with the site base URL
- [ ] A short Docs AI edit succeeds while Internet is blocked
- [ ] With LLM stopped, AI fails with a clear connection error (no silent cloud fallback)

## Features that must stay off unless approved

- [ ] Auto-update does **not** contact any host (`ARKOFFICE_AUTO_UPDATE` unset / preferences disabled)
- [ ] Web search tools return disabled / empty without `ARKOFFICE_ALLOW_WEB_SEARCH=1`
- [ ] No third-party SaaS sign-in is required to use AI

## Security / ops

- [ ] Code signing uses the deploying organization’s certificates (or risk accepted)
- [ ] Network allowlist reviewed: [`network-allowlist.md`](network-allowlist.md)
- [ ] Deployment runbook reviewed: [`air-gapped-deployment.md`](air-gapped-deployment.md)
- [ ] Sample org settings (if used) match site policy under `docs/examples/`

## Sign-off

| Role | Name | Date | Result |
| ---- | ---- | ---- | ------ |
| Engineering |  |  |  |
| Security / InfoSec |  |  |  |
| Business owner |  |  |  |
