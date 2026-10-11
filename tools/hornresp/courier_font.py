#!/usr/bin/env python3
"""Copy a font under the family name "Courier New", for Hornresp under Wine (it stops without that font).

Liberation Mono has Courier New's metrics. Run once per style into the prefix's Fonts folder:

    for s in Regular Bold Italic BoldItalic; do
      python3 courier_font.py /usr/share/fonts/truetype/liberation/LiberationMono-$s.ttf \\
        "$WINEPREFIX/drive_c/windows/Fonts/cour-$s.ttf" $s
    done

Needs fontTools (pip install fonttools).
"""

import sys

from fontTools.ttLib import TTFont

#: the name table's family (1, 16), full name (4) and PostScript name (6) records
FAMILY, TYPO_FAMILY, FULL_NAME, POSTSCRIPT_NAME = 1, 16, 4, 6

source, target, style = sys.argv[1:4]
font = TTFont(source)
for record in font["name"].names:
    if record.nameID in (FAMILY, TYPO_FAMILY):
        record.string = "Courier New"
    elif record.nameID == FULL_NAME:
        record.string = "Courier New" + ("" if style == "Regular" else " " + style)
    elif record.nameID == POSTSCRIPT_NAME:
        record.string = "CourierNewPS" + style + "MT"
font.save(target)
