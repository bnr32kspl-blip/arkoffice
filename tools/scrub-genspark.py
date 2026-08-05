#!/usr/bin/env python3
"""Scrub product-facing Genspark trademark strings/identifiers from the tree.

Keeps unavoidable technical identifiers:
  - npm package @genspark/cli and its require paths
  - ~/.genspark-tool-cli config path (upstream CLI writes there)
  - API host genspark.ai only inside packages/ai-search gsk client + quota detectors
  - legacy settings migration key 'genspark' in ai-provider
  - README/NOTICE/check scripts (attribution / scanners)
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "out",
    "dist",
    "release",
    "vendor",
    ".cursor",
    "__pycache__",
}
SKIP_FILES = {
    "package-lock.json",
    "THIRD-PARTY-NOTICES.txt",
}
ALLOWLIST_REL = {
    "NOTICE",
    "README.md",
    "CONTRIBUTING.md",
    "tools/check-trademarks.mjs",
    "tools/check-no-ee.mjs",
    "tools/check-airgap-defaults.mjs",
    "tools/scrub-genspark.py",
    "tools/gen-third-party-notices.mjs",
    "docs/network-allowlist.md",
    "packages/ai-search/package.json",  # dependency name @genspark/cli
}

TEXT_SUFFIXES = {
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".html",
    ".css",
    ".txt",
    ".svg",
    ".rs",
    ".plist",
}

# Protect tokens during bulk replace
PROTECT = [
    ("@genspark/cli", "@@PKG_GSK_CLI@@"),
    ("genspark-ai/", "@@GH_ORG@@"),
    (".genspark-tool-cli", "@@GSK_CONFIG_DIR@@"),
    ("www.genspark.ai", "@@GSK_HOST@@"),
    ("sspark.genspark.ai", "@@GSK_CDN@@"),
    ("genspark.ai/pricing", "@@GSK_PRICING@@"),
    ("genspark.ai/cli-auth", "@@GSK_AUTH@@"),
    ("genspark.ai", "@@GSK_DOMAIN@@"),  # after more specific
    # Legacy settings slot — must keep reading old user configs
    ("'genspark'", "@@LEGACY_PROVIDER_SQ@@"),
    ('"genspark"', "@@LEGACY_PROVIDER_DQ@@"),
    ("'genspark' as never", "@@LEGACY_PROVIDER_AS@@"),
]


def should_skip(rel: str, path: Path) -> bool:
    parts = Path(rel).parts
    if any(p in SKIP_DIR_NAMES for p in parts):
        return True
    if path.name in SKIP_FILES:
        return True
    if rel.replace("\\", "/") in ALLOWLIST_REL:
        return True
    return False


def protect(text: str) -> str:
    for a, b in PROTECT:
        text = text.replace(a, b)
    return text


def unprotect(text: str) -> str:
    for a, b in PROTECT:
        text = text.replace(b, a)
    return text


def transform(text: str, rel: str) -> str:
    text = protect(text)

    # --- identifier / symbol renames (order matters) ---
    renames = [
        ("GensparkMark", "ArkOfficeMark"),
        ("genspark-badge", "ark-mark-badge"),
        ("ribbon-genspark-sep", "ribbon-ai-sep"),
        ("ribbon-genspark-btn", "ribbon-ai-btn"),
        ("accountGenspark", "accountLabel"),
        ("loginGenspark", "loginAccount"),
        ("loggedInGenspark", "loggedInAccount"),
        ("aiGensparkAccount", "aiAccountLabel"),
        ("aiLoginGenspark", "aiLoginAccount"),
        ("appGensparkAccount", "appAccountLabel"),
        ("appLoginGenspark", "appLoginAccount"),
        ("openGenTeam", "openCommunity"),
        ("GENTEAM_URL", "COMMUNITY_URL"),
        ("HOME_CHANNELS.openCommunity", "HOME_CHANNELS.openCommunity"),  # noop safety
    ]
    for a, b in renames:
        text = text.replace(a, b)

    # Channel string literals if any
    text = text.replace("'openGenTeam'", "'openCommunity'")
    text = text.replace('"openGenTeam"', '"openCommunity"')

    # Phrase-level user strings (before bare Genspark)
    phrase_map = [
        (
            "Your Genspark credits have run out. Visit @@GSK_PRICING@@ to top up, then try again",
            "AI quota exhausted. Check your AI provider settings, then try again",
        ),
        (
            "Your Genspark credits have been exhausted. Please visit https://@@GSK_PRICING@@ to purchase more credits.",
            "AI quota exhausted. Check your AI provider settings.",
        ),
        (
            "Gensparkクレジットを使い切りました。@@GSK_PRICING@@ でチャージしてから再試行してください",
            "AI の利用枠を使い切りました。AI プロバイダ設定を確認してから再試行してください",
        ),
        (
            "Genspark 积分已用完，请前往 @@GSK_PRICING@@ 充值后重试",
            "AI 额度已用完，请检查 AI 提供方设置后重试",
        ),
        (
            "Genspark 點數已用完，請前往 @@GSK_PRICING@@ 儲值後重試",
            "AI 額度已用完，請檢查 AI 提供者設定後重試",
        ),
        (
            "Sign in with Genspark",
            "Sign in",
        ),
        (
            "Signed in to Genspark",
            "Signed in",
        ),
        (
            "Genspark Account",
            "Account",
        ),
        (
            "Genspark account",
            "Account",
        ),
        (
            "Genspark 账号",
            "账号",
        ),
        (
            "Genspark アカウント",
            "アカウント",
        ),
        (
            "Genspark にサインイン",
            "サインイン",
        ),
        (
            "Genspark アカウントでサインイン",
            "サインイン",
        ),
        (
            "Genspark にサインイン済み",
            "サインイン済み",
        ),
        (
            "登录 Genspark 账号",
            "登录账号",
        ),
        (
            "登录 Genspark",
            "登录",
        ),
        (
            "已登录 Genspark",
            "已登录",
        ),
        (
            "Not signed in to Genspark",
            "Not signed in",
        ),
        (
            "sign in to Genspark",
            "sign in",
        ),
        (
            "Sign in to Genspark",
            "Sign in",
        ),
        (
            "Cloud slide generation is unavailable — sign in to Genspark (gsk) first",
            "Cloud slide generation is unavailable — optional CLI is not signed in",
        ),
        (
            "Cloud slide generation is unavailable \u2014 sign in to Genspark (gsk) first",
            "Cloud slide generation is unavailable — optional CLI is not signed in",
        ),
        (
            "AI image generation/editing (Genspark).",
            "AI image generation/editing (optional cloud CLI).",
        ),
        (
            "Analyze media content (Genspark):",
            "Analyze media content (optional cloud CLI):",
        ),
        (
            "Genspark composer style",
            "compact composer style",
        ),
        (
            "Not logged in to Genspark (gsk login)",
            "Optional cloud CLI is not signed in (gsk login)",
        ),
        (
            "Exporting as Word requires signing in to Genspark.",
            "Exporting as Word requires signing in to the optional cloud converter.",
        ),
        (
            "Upload this PDF to Genspark cloud and convert it to Word?",
            "Upload this PDF to the cloud converter and convert it to Word?",
        ),
        (
            "Cannot sign in to Genspark:",
            "Cannot sign in to the cloud converter:",
        ),
        (
            "Word への書き出しには Genspark へのログインが必要です。",
            "Word への書き出しにはクラウド変換サービスへのログインが必要です。",
        ),
        (
            "この PDF を Genspark クラウドにアップロードして Word に変換しますか？",
            "この PDF をクラウド変換サービスにアップロードして Word に変換しますか？",
        ),
        (
            "Genspark にサインインできません：",
            "クラウド変換サービスにサインインできません：",
        ),
        (
            "导出为 Word 需要登录 Genspark 账号。",
            "导出为 Word 需要登录云端转换服务账号。",
        ),
        (
            "将此 PDF 上传到 Genspark 云端转换为 Word？",
            "将此 PDF 上传到云端转换服务转换为 Word？",
        ),
        (
            "无法登录 Genspark：",
            "无法登录云端转换服务：",
        ),
    ]
    for a, b in phrase_map:
        text = text.replace(a, b)

    # Bare brand tokens
    text = text.replace("Genspark", "ArkOffice")
    # lowercase product mentions (not protected package paths)
    text = re.sub(r"(?<!@)\bgenspark\b", "arkoffice", text, flags=re.I)
    # Fix over-replacements from case-insensitive? we used word boundary lowercase only via re.I on genspark
    # Restore mistaken ArkOffice in places that became ArkOffice from Genspark already done

    text = unprotect(text)

    # Community URL: do not keep pointing at genspark.ai
    if rel.replace("\\", "/") == "apps/shell/src/main/index.ts":
        text = re.sub(
            r"const COMMUNITY_URL = 'https://www\.genspark\.ai/[^']*'",
            "const COMMUNITY_URL = ''",
            text,
        )
        text = re.sub(
            r"// Stable short link served by the genspark\.ai site;.*\n",
            "// Community link disabled (no third-party branding destination).\n",
            text,
        )

    # Credits messages that still contain pricing URL after partial replace
    text = re.sub(
        r"[^\n]*@@GSK_PRICING@@[^\n]*",
        "",
        text,
    )  # shouldn't remain after unprotect
    text = text.replace(
        "Visit genspark.ai/pricing to top up, then try again",
        "Check your AI provider settings, then try again",
    )

    return text


def main() -> None:
    changed = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        if should_skip(rel, path):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name != "CODEOWNERS":
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if "genspark" not in original.lower() and "GensparkMark" not in original and "GenTeam" not in original:
            # still may need GenTeam/openGenTeam
            if "openGenTeam" not in original and "GENTEAM" not in original and "genspark-badge" not in original:
                continue
        updated = transform(original, rel)
        if updated != original:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed.append(rel)

    print(f"updated {len(changed)} files")
    for rel in changed[:80]:
        print(" ", rel)
    if len(changed) > 80:
        print(f"  … +{len(changed) - 80} more")


if __name__ == "__main__":
    main()
