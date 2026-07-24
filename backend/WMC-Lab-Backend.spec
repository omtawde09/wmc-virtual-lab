# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the WMC Virtual Lab backend .exe.

The two things a naive `pyinstaller run_server.py` gets wrong, both handled here:

  1. bleak's Windows backend uses the pywinrt projection (winrt.windows.*),
     which is imported dynamically and therefore invisible to PyInstaller's
     static analysis. Every winrt namespace module bleak touches is listed
     explicitly in `hiddenimports`, plus collect_all('bleak').

  2. uvicorn dynamically imports its protocol/loop implementations
     (h11, websockets, asyncio loop, ...) by string, so they are collected
     via collect_submodules('uvicorn').
"""

from PyInstaller.utils.hooks import collect_all, collect_submodules

# --- bleak + its pywinrt projection (the classic PyInstaller gotcha) ---
winrt_modules = [
    "winrt.runtime",
    "winrt._winrt",
    "winrt.system",
    "winrt.windows.devices.bluetooth",
    "winrt.windows.devices.bluetooth.advertisement",
    "winrt.windows.devices.bluetooth.genericattributeprofile",
    "winrt.windows.devices.enumeration",
    "winrt.windows.devices.radios",
    "winrt.windows.foundation",
    "winrt.windows.foundation.collections",
    "winrt.windows.storage.streams",
]

hiddenimports = []
datas = []
binaries = []

for pkg in ("bleak", "docx"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

hiddenimports += winrt_modules
hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("winrt")
hiddenimports += [
    "anyio",
    "anyio._backends._asyncio",
    "websockets",
    "websockets.legacy",
    "h11",
    # The app's own modules (imported via `from main import app`).
    "main",
    "wifi_scanner",
    "network_tester",
    "multipath_analyzer",
    "interference_analyzer",
    "bluetooth_scanner",
    "bluetooth_connection",
    "bluetooth_analyzer",
    "bluetooth_pathloss",
    "doc_export",
    "docx",
]

block_cipher = None

a = Analysis(
    ["run_server.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PyQt5", "PySide2", "pytest"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="WMC-Lab-Backend",
    # Embeds author/product info into the exe's Windows "Details" tab. Free, no
    # certificate required. Does NOT suppress SmartScreen/AV warnings.
    version="version_info.txt",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # UPX packing is a well-known antivirus false-positive amplifier (packed
    # binaries look like obfuscated malware to heuristic scanners). Explicitly
    # off so a build machine that happens to have UPX installed cannot silently
    # produce a more-flagged exe than the one tested here.
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # keep the console window so users see the server running
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
