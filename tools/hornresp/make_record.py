#!/usr/bin/env python3
"""Write a Hornresp record (an "Import" text file) from a template record and new values.

Start from a record Hornresp exported or imported before (tests/hornresp/*.txt). Give the values to change; the
script keeps the rest. It applies the rules Hornresp checks on import:

- CRLF on every line.
- Segment rows chain: each row's first area is the row before's last.
- The mouth key: Cir (mouth circumference in flare-cutoff wavelengths) when the last segment is exponential, Fta
  (the mouth's wall angle, degrees) when it is conical. Exponential rows also carry their cutoff, F12 to F45.
- Keys that appear twice (Le, Rms) change only in the traditional driver section.

Example (a 10" mid horn, Le 0.6 mH, a vented rear chamber):

    python3 make_record.py tests/hornresp/mid-vented.txt /tmp/mid-le.txt \\
        --comment "validation: mid with Le" --set Le=0.60 --set Vrc=17.00 \\
        --vent 120:23.31 --segments exp:400:1400:35

Values are Hornresp's units: areas cm², lengths cm, Vrc litres, Vtc cc, Le mH, Mmd g.
"""

import argparse
import math
import re
import sys

#: Hornresp's speed of sound in this repo's runs (the planner's air; see docs/horn-engine-plan.md), m/s
SPEED_OF_SOUND = 343.0
#: the record's horn rows: (start area key, end area key, length suffix)
ROWS = (("S1", "S2", "12"), ("S2", "S3", "23"), ("S3", "S4", "34"), ("S4", "S5", "45"))
#: profile names as the record keys them
PROFILE_KEYS = {"con": "Con", "exp": "Exp"}


def parse_segments(text):
    """'exp:400:1400:35,con:1400:2000:20' -> [(profile, s1, s2, length)], cm² and cm."""
    segments = []
    for part in text.split(","):
        profile, s1, s2, length = part.split(":")
        if profile not in PROFILE_KEYS:
            sys.exit(f"unknown profile {profile!r}: use con or exp")
        segments.append((profile, float(s1), float(s2), float(length)))
    if not 1 <= len(segments) <= 4:
        sys.exit("Hornresp takes 1 to 4 segments")
    for (_, _, end, _), (_, start, _, _) in zip(segments, segments[1:]):
        if abs(end - start) > 1e-9:
            sys.exit("segments must chain: each one starts where the one before ends")
    return segments


def cutoff(s1, s2, length_cm):
    """An exponential segment's flare cutoff, Hz: c·ln(S2/S1)/(4π·L)."""
    return SPEED_OF_SOUND * math.log(s2 / s1) / (4 * math.pi * length_cm / 100)


def horn_block(segments):
    """The record's horn rows and its mouth key and value."""
    lines = []
    for i, (a, b, ij) in enumerate(ROWS):
        if i >= len(segments):
            lines += [f"{a} = 0.00", f"{b} = 0.00", f"L{ij} = 0.00", f"F{ij} = 0.00"]
            continue
        profile, s1, s2, length = segments[i]
        fc = cutoff(s1, s2, length) if profile == "exp" else 0
        lines += [f"{a} = {s1:.2f}", f"{b} = {s2:.2f}", f"{PROFILE_KEYS[profile]} = {length:.2f}", f"F{ij} = {fc:.2f}"]
    profile, s1, s2, length = segments[-1]
    radius = lambda area: math.sqrt(area / math.pi)
    if profile == "exp":
        mouth = ("Cir", 2 * math.pi * (radius(s2) / 100) * cutoff(s1, s2, length) / SPEED_OF_SOUND)
    else:
        mouth = ("Fta", math.degrees(math.atan((radius(s2) - radius(s1)) / length)))
    return lines, mouth


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("template", help="a record to start from")
    parser.add_argument("output", help="the record to write")
    parser.add_argument("--set", action="append", default=[], metavar="KEY=VALUE", help="a value to change")
    parser.add_argument("--segments", help="the horn: profile:s1:s2:length,... (cm², cm)")
    parser.add_argument("--vent", metavar="AREA:LENGTH", help="a vented rear chamber: Ap (cm²) and Lpt (cm)")
    parser.add_argument("--sealed", action="store_true", help="a sealed, unlined rear chamber")
    parser.add_argument("--comment", help="the record's comment")
    args = parser.parse_args()

    changes = dict(item.split("=", 1) for item in args.set)
    if args.comment:
        changes["Comment"] = args.comment
    lines = open(args.template, encoding="latin1").read().replace("\r", "").split("\n")
    horn = horn_block(parse_segments(args.segments)) if args.segments else None

    out, section, seen = [], "", set()
    for line in lines:
        if line.startswith("|"):
            section = line
        if horn and section.startswith("|HORN PARAMETER"):
            if line.startswith("|"):
                out += [line, "", *horn[0], ""]
            continue
        match = re.match(r"^(.+?) = (.*)$", line)
        if not match:
            out.append(line)
            continue
        key = match.group(1)
        if key in ("Le", "Rms"):
            if key in seen:
                out.append(line)
                continue
            seen.add(key)
        if horn and key in ("Cir", "Fta"):
            out.append(f"{horn[1][0]} = {horn[1][1]:.2f}")
        elif args.vent and key in ("Fr", "Ap"):
            out.append(f"Ap = {float(args.vent.split(':')[0]):.2f}")
        elif args.vent and key in ("Tal", "Lpt"):
            out.append(f"Lpt = {float(args.vent.split(':')[1]):.2f}")
        elif args.sealed and key in ("Fr", "Ap"):
            out.append("Fr = 0.00")
        elif args.sealed and key in ("Tal", "Lpt"):
            out.append("Tal = 0.00")
        elif key in changes:
            out.append(f"{key} = {changes.pop(key)}")
        else:
            out.append(line)
    if changes:
        sys.exit(f"not in the template: {', '.join(changes)}")
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(out))
    open(args.output, "w", encoding="latin1", newline="").write(text.replace("\n", "\r\n"))


if __name__ == "__main__":
    main()
