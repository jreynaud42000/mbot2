# -*- mode: python ; coding: utf-8 -*-
# Mode dossier ("onedir", comme l'editeur micro:bit) : dist/Mbot2Easybloc_V1/ contient l'exe et _internal/.
# Un exe unique ("onefile") se decompresse dans un dossier temporaire a chaque lancement : Defender le classe
# souvent comme dangereux. Distribuer le dossier entier (zip), jamais l'exe seul.
# Construction : python -m PyInstaller --noconfirm app.spec
# Tout nouveau fichier charge par index.html doit etre ajoute a la liste datas ci-dessous.


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('index.html', '.'), ('app.js', '.'), ('bandeau.js', '.'), ('blocs.js', '.'), ('exemples_aide.js', '.'),
           ('simulateur.js', '.'), ('televersement.js', '.'), ('tuto.js', '.'), ('logo.png', '.'),
           ('logo_ts.png', '.'), ('logo_ts_clair.png', '.'), ('images', 'images'), ('lib', 'lib')],
    hiddenimports=[],
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
    [],
    exclude_binaries=True,
    name='Mbot2Easybloc_V1',
    version='version_info.txt',
    icon='icone.ico',   # robot dessine sur fond bleu nuit (creer_icone.py, nov. 2026)
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='Mbot2Easybloc_V1',
)
