"""Launcher for FDR Drama DL Pro (Electron JS Desktop Application)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
ELECTRON_EXE = ROOT_DIR / "node_modules" / "electron" / "dist" / "electron.exe"

def launch_electron() -> None:
    if ELECTRON_EXE.is_file():
        creationflags = 0
        if sys.platform == "win32":
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(
            [str(ELECTRON_EXE), str(ROOT_DIR), *sys.argv[1:]],
            cwd=str(ROOT_DIR),
            creationflags=creationflags
        )
    else:
        # Fallback to npx or npm start
        subprocess.Popen(
            ["cmd.exe", "/c", "npm", "start"],
            cwd=str(ROOT_DIR)
        )

if __name__ == "__main__":
    launch_electron()
