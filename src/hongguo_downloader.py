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
parser_module = importlib.import_module("1")

def download_hongguo_vid(vid: str, output_path: str) -> bool:
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    # Point temp/output directory to target folder so downloads write directly to target disk
    os.environ["DUANJU_TEMP_DIR"] = str(out_file.parent)
    os.environ["DUANJU_OUTPUT_DIR"] = str(out_file.parent)
    
    last_err = ""
    for attempt in range(2):
        try:
            result = parser_module.resolve_video_url(str(vid).strip(), max_retries=2)
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
            time.sleep(0.3)

    print(f"ERROR:{last_err}")
    return False

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        ok = download_hongguo_vid(sys.argv[1], sys.argv[2])
        sys.exit(0 if ok else 1)
    else:
        print("Usage: python hongguo_downloader.py <vid> <output_path>")
        sys.exit(1)
