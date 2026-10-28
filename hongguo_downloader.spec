# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['src/hongguo_downloader.py'],
    pathex=[],
    binaries=[],
    datas=[('short-drama-downloader-main/short-drama-downloader-main/源码_开源版/1.py', '.'), ('short-drama-downloader-main/short-drama-downloader-main/源码_开源版/liushen', 'liushen')],
    hiddenimports=['betterproto', 'gmssl', 'gmssl.sm3', 'Crypto', 'Crypto.Cipher.AES', 'Crypto.Util.Counter', 'Crypto.Util.Padding', 'requests', 'lxml', 'bs4'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='hongguo_downloader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
