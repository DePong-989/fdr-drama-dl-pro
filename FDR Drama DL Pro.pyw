"""Windowed launcher (no terminal console) for FDR Drama DL Pro (Electron JS)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
ELECTRON_EXE = ROOT_DIR / "node_modules" / "electron" / "dist" / "electron.exe"

def main() -> None:
    creationflags = 0
    if sys.platform == "win32":
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

    if ELECTRON_EXE.is_file():
        subprocess.Popen(
            [str(ELECTRON_EXE), str(ROOT_DIR), *sys.argv[1:]],
            cwd=str(ROOT_DIR),
            creationflags=creationflags
        )
    else:
        subprocess.Popen(
            ["cmd.exe", "/c", "npm", "start"],
            cwd=str(ROOT_DIR),
            creationflags=creationflags
        )

if __name__ == "__main__":
    main()
