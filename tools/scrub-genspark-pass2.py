#!/usr/bin/env python3
"""Second-pass cleanup after scrub-genspark.py."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "node_modules", "out", "dist", "release", "vendor", ".cursor"}


def main() -> None:
    for p in [
        ROOT / "apps/slides/src/renderer/components/icons.tsx",
        ROOT / "apps/docs/src/renderer/components/icons.tsx",
        ROOT / "apps/sheets/src/renderer/ribbon-icons.tsx",
        ROOT / "apps/pdf/src/renderer/ai/AiPanel.tsx",
    ]:
        t = p.read_text(encoding="utf-8")
        t2 = t.replace(
            "export { ArkOfficeMark as ArkOfficeMark, ArkOfficeMark } from '@arkoffice/ui'",
            "export { ArkOfficeMark } from '@arkoffice/ui'",
        )
        if t2 != t:
            p.write_text(t2, encoding="utf-8")
            print("fixed export", p.relative_to(ROOT))

    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if any(x in p.parts for x in SKIP):
            continue
        if p.suffix.lower() not in {".ts", ".tsx", ".js", ".mjs", ".cjs", ".md", ".css"}:
            continue
        try:
            t = p.read_text(encoding="utf-8")
        except OSError as e:
            print("skip read", p, e)
            continue
        if (
            "GenSpark" not in t
            and "genteam" not in t.lower()
            and "genspark.ai" not in t
            and "Genspark" not in t
            and "genspark" not in t
        ):
            continue
        # Leave allowlisted technical / docs for trademark scanner later
        rel = str(p.relative_to(ROOT)).replace("\\", "/")
        if rel in {
            "README.md",
            "NOTICE",
            "CONTRIBUTING.md",
            "tools/scrub-genspark.py",
            "tools/scrub-genspark-pass2.py",
            "tools/check-trademarks.mjs",
            "tools/check-airgap-defaults.mjs",
            "tools/gen-third-party-notices.mjs",
            "docs/network-allowlist.md",
            "packages/ai-search/package.json",
        }:
            continue

        orig = t
        t = t.replace("GenSparkAccountStatus", "ToolCliAccountStatus")
        t = t.replace("home:open-genteam", "home:open-community")
        t = t.replace("GenTeam", "community")
        t = re.sub(
            r"aiCreditsExhausted:\s*'[^']*genspark\.ai/pricing[^']*'",
            "aiCreditsExhausted: 'AI quota exhausted. Check your AI provider settings and try again'",
            t,
        )
        t = re.sub(
            r"(aiCreditsExhausted:\s*\n\s*)'[^']*genspark\.ai/pricing[^']*'",
            r"\1'AI quota exhausted. Check your AI provider settings and try again'",
            t,
        )
        if "/i18n/" in rel or rel.endswith("strings.ts") or rel.endswith("strings-ai.ts"):
            # Strip leftover pricing host mentions from UI copy
            t = t.replace("genspark.ai/pricing", "your AI provider settings")
            t = t.replace("genspark.ai", "your AI provider")
        if rel.startswith("apps/") or (
            rel.startswith("packages/")
            and rel
            not in {
                "packages/ai-search/src/gsk.ts",
                "packages/ai-search/tests/gsk.test.ts",
                "packages/ai-search/tests/gsk-login.test.ts",
                "packages/ai-provider/src/stream.ts",
                "packages/ai-provider/tests/stream.test.ts",
                "packages/ai-provider/tests/chat.test.ts",
            }
        ):
            t = t.replace("https://www.genspark.ai", "https://example.com")
            t = t.replace("https://sspark.genspark.ai", "https://example.com")
            t = t.replace("https://genspark.ai", "https://example.com")
            t = t.replace("query: 'genspark'", "query: 'arkoffice'")
            t = t.replace("containsText: 'genspark'", "containsText: 'arkoffice'")
            t = t.replace("containsText: 'GenSpark'", "containsText: 'SampleBrand'")
            t = t.replace("Genspark", "ArkOffice")
            # bare leftover product word in comments/UI (not package names)
            t = re.sub(r"(?<!@|/|\.)\bgenspark\b", "arkoffice", t, flags=re.I)

        if t != orig:
            try:
                p.write_text(t, encoding="utf-8")
                print("patched", rel)
            except OSError as e:
                print("skip write", rel, e)


if __name__ == "__main__":
    main()
