# -*- coding: utf-8 -*-
"""
Horizun / console: лист Revit → PNG + SVG hit-оверлей.

Предпочтительно: pyRevit Vodnal → BIM Web → «Лист».
"""
from __future__ import print_function

import os
import sys
import traceback

SHEET_OR_VIEW_ID = 0
# Папка sheets/<kr|tx>/ (без имени файла)
OUTPUT_DIR = r""
LAYER = "kr"
SLUG = ""

_EXT_LIB = os.path.expandvars(
    r"%APPDATA%\pyRevit\Extensions\Vodnal.extension\lib"
)
if _EXT_LIB not in sys.path and os.path.isdir(_EXT_LIB):
    sys.path.insert(0, _EXT_LIB)

try:
    import bim_web_sheet as bs
except ImportError as exc:
    __output__ = {"ok": False, "error": "bim_web_sheet not found: {}".format(exc)}
    raise SystemExit(0)

try:
    uidoc = __revit__.ActiveUIDocument
    doc = uidoc.Document
    if not OUTPUT_DIR:
        raise RuntimeError("Set OUTPUT_DIR to sheets/<kr|tx>/ folder")
    out_dir = bs.default_sheets_dir(OUTPUT_DIR, layer=LAYER) if not OUTPUT_DIR.endswith(
        ("kr", "tx", "kr\\", "tx\\", "kr/", "tx/")
    ) else OUTPUT_DIR
    # если передали уже sheets/kr — использовать как есть
    if os.path.basename(OUTPUT_DIR.rstrip("\\/")) in ("kr", "tx"):
        out_dir = OUTPUT_DIR
    __output__ = bs.export_sheet_bundle(
        doc,
        uidoc,
        out_dir,
        sheet_id=SHEET_OR_VIEW_ID,
        slug=SLUG or None,
    )
except Exception as exc:
    __output__ = {
        "ok": False,
        "error": str(exc),
        "traceback": traceback.format_exc(),
    }
