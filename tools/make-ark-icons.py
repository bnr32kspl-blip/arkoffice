"""Generate ArkOffice icon assets from the shield-A source PNG."""
from __future__ import annotations

import base64
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_CANDIDATES = [
    ROOT / "apps/shell/build/icon-source.png",
    Path(
        r"C:\Users\tkash\.cursor\projects\c-Users-tkash-Documents-arkoffice\assets"
        r"\c__Users_tkash_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
        r"_ARK_icon-transparent-478a7842-2f14-4500-9d5a-f1599a8679e2.png"
    ),
]
ASSETS = ROOT / "apps/shell/src/renderer/src/assets"
BUILD = ROOT / "apps/shell/build"


def find_source() -> Path:
    for p in SRC_CANDIDATES:
        if p.is_file():
            return p
    raise SystemExit("icon source PNG not found")


def make_transparent_square(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            if r < 18 and g < 18 and b < 18:
                pixels[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if not bbox:
        raise SystemExit("no opaque pixels in source icon")
    crop = im.crop(bbox)
    cw, ch = crop.size
    side = max(cw, ch)
    pad = int(side * 0.08)
    side2 = side + pad * 2
    sq = Image.new("RGBA", (side2, side2), (0, 0, 0, 0))
    sq.paste(crop, ((side2 - cw) // 2, (side2 - ch) // 2), crop)
    return sq


def on_black_plate(mark: Image.Image, size: int) -> Image.Image:
    """OS / installer icons: navy mark on solid black square (matches brand art)."""
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    scaled = mark.resize((size, size), Image.Resampling.LANCZOS)
    plate.alpha_composite(scaled)
    return plate


def write_ico(master: Image.Image, dest: Path, sizes: list[int]) -> None:
    entries: list[tuple[int, bytes]] = []
    for s in sizes:
        buf = BytesIO()
        master.resize((s, s), Image.Resampling.LANCZOS).save(buf, format="PNG")
        entries.append((s, buf.getvalue()))

    num = len(entries)
    header = struct.pack("<HHH", 0, 1, num)
    offset = 6 + 16 * num
    dirs = b""
    data = b""
    for s, blob in entries:
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        dirs += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(blob), offset)
        data += blob
        offset += len(blob)
    dest.write_bytes(header + dirs + data)


def png_b64(im: Image.Image) -> str:
    buf = BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    src = find_source()
    # Keep a stable copy in the repo tree for regenerating icons later
    archived = BUILD / "icon-source.png"
    if src.resolve() != archived.resolve():
        archived.write_bytes(src.read_bytes())

    sq = make_transparent_square(archived)
    master_clear = sq.resize((1024, 1024), Image.Resampling.LANCZOS)
    master_plate = on_black_plate(master_clear, 1024)

    # UI: transparent mark (sidebar / light surfaces)
    master_clear.save(ASSETS / "arkoffice-icon.png", "PNG")
    master_clear.resize((256, 256), Image.Resampling.LANCZOS).save(
        ASSETS / "app-icon.png", "PNG"
    )
    master_clear.resize((40, 40), Image.Resampling.LANCZOS).save(
        ASSETS / "arkoffice-mark.png", "PNG"
    )
    master_clear.resize((80, 80), Image.Resampling.LANCZOS).save(
        ASSETS / "arkoffice-mark@2x.png", "PNG"
    )

    # OS / installer: black plate
    master_plate.resize((512, 512), Image.Resampling.LANCZOS).save(BUILD / "icon.png", "PNG")
    master_plate.save(BUILD / "icon-mac.png", "PNG")
    write_ico(master_plate, BUILD / "icon.ico", [16, 24, 32, 48, 64, 128, 256])

    mark120 = master_clear.resize((120, 120), Image.Resampling.LANCZOS)
    b64 = png_b64(mark120)
    (ASSETS / "arkoffice-mark.svg").write_text(
        '<svg width="40" height="40" viewBox="0 0 40 40" '
        'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n'
        f'  <image href="data:image/png;base64,{b64}" width="40" height="40"/>\n'
        "</svg>\n",
        encoding="utf-8",
    )
    (ASSETS / "arkoffice-logo.svg").write_text(
        '<svg width="220" height="40" viewBox="0 0 220 40" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        f'  <image href="data:image/png;base64,{b64}" x="0" y="0" width="40" height="40"/>\n'
        '  <text x="48" y="28" fill="#111" '
        'font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" '
        'font-size="22" font-weight="650" letter-spacing="-0.02em">ArkOffice</text>\n'
        "</svg>\n",
        encoding="utf-8",
    )

    print(f"source: {archived}")
    for p in [
        ASSETS / "app-icon.png",
        ASSETS / "arkoffice-logo.svg",
        BUILD / "icon.png",
        BUILD / "icon.ico",
    ]:
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
