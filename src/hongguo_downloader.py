"""Hongguo VID Decryptor and Downloader for Electron IPC."""
from __future__ import annotations

import os
import shutil
import sys
import time
from pathlib import Path

# Force UTF-8 on Windows stdout/stderr to prevent UnicodeEncodeError with Khmer/Chinese characters
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "short-drama-downloader-main" / "short-drama-downloader-main" / "源码_开源版"

search_dirs = [BASE_DIR, BASE_DIR / "liushen", SRC_DIR, SRC_DIR / "liushen"]
for p in search_dirs:
    if p.exists():
        s = str(p)
        if s not in sys.path:
            sys.path.insert(0, s)

import importlib
import requests
parser_module = importlib.import_module("1")


def download_via_hongguo_web(vid: str, out_file: Path) -> bool:
    """Fallback downloader using hongguoduanju.com protected/public video endpoints."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://hongguoduanju.com/",
    }
    candidate_urls = []
    try:
        r = requests.post(
            "https://hongguoduanju.com/api/video/protected/fallback-play-info",
            json={"item_id": str(vid).strip()},
            headers=headers,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            for k in ("main_url", "backup_url_1"):
                u = data.get(k) or (data.get("data") or {}).get(k)
                if u and u.startswith("http"):
                    candidate_urls.append(u)
    except Exception:
        pass

    candidate_urls.append(f"https://hongguoduanju.com/video/public/{str(vid).strip()}/360p.mp4")

    for url in candidate_urls:
        try:
            with requests.get(url, headers=headers, stream=True, timeout=20) as resp:
                if resp.status_code == 200:
                    tmp_path = out_file.with_suffix(".web.tmp")
                    with open(tmp_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=262144):
                            if chunk:
                                f.write(chunk)
                    if tmp_path.exists() and tmp_path.stat().st_size >= 100000:
                        shutil.move(str(tmp_path), str(out_file))
                        return True
                    tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
    return False


def download_hongguo_vid(vid: str, output_path: str) -> bool:
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    # Point temp/output directory to target folder so downloads write directly to target disk
    os.environ["DUANJU_TEMP_DIR"] = str(out_file.parent)
    os.environ["DUANJU_OUTPUT_DIR"] = str(out_file.parent)
    
    last_err = ""
    for attempt in range(2):
        try:
            result = parser_module.resolve_video_url(str(vid).strip(), max_retries=1)
            temp_file = result.get("url") if isinstance(result, dict) else None
            if temp_file and os.path.isfile(temp_file):
                temp_path = Path(temp_file).resolve()
                if temp_path.stat().st_size >= 100000:
                    if temp_path != out_file:
                        shutil.move(str(temp_path), str(out_file))
                    print("SUCCESS")
                    return True
                else:
                    try:
                        temp_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    last_err = "Downloaded video too small (<100KB)"
            else:
                last_err = "Output video file not produced"
        except Exception as exc:
            last_err = str(exc)
            time.sleep(0.2)

    if download_via_hongguo_web(vid, out_file):
        print("SUCCESS")
        return True

    print(f"ERROR:{last_err}")
    return False

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        ok = download_hongguo_vid(sys.argv[1], sys.argv[2])
        sys.exit(0 if ok else 1)
    else:
        print("Usage: python hongguo_downloader.py <vid> <output_path>")
        sys.exit(1)
