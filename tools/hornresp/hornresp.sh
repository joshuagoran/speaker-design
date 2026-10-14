# Drives Hornresp 60.60 under Wine on a virtual display with xdotool: start it, set the air, import a record,
# calculate it and export its results. Source this file, then call the functions (see README.md).
#
# Fragile by nature: it clicks at screen positions. They hold for a 1600 x 1000 Xvfb screen with no window manager,
# where Wine opens Hornresp's main window at 483,289. Check each step with `shot` when something goes wrong.
#
# Settings (environment):
#   HR_DIR      the folder with Hornresp.exe (Hornresp makes Import/, Export/ and Data/ in it)
#   WINEPREFIX  the Wine prefix (with the "Courier New" font; see README.md)
#   SHOT_DIR    where `shot` writes screenshots (default: /tmp)

export DISPLAY="${DISPLAY:-:99}"
export WINEDEBUG=-all
: "${HR_DIR:?set HR_DIR to the folder with Hornresp.exe}"
SHOT_DIR="${SHOT_DIR:-/tmp}"

# The visible window with this title (a regex), if any.
win() { xdotool search --onlyvisible --name "$1" 2>/dev/null | head -1; }
# The visible windows' titles.
wins() { xdotool search --onlyvisible --name "." 2>/dev/null | while read -r w; do xdotool getwindowname "$w"; done | grep -v '^Hornresp$'; }
# Wait up to ~10 s for a window with this title; fails if it never shows.
wait_win() { for _ in $(seq 1 50); do [ -n "$(win "$1")" ] && return 0; sleep 0.2; done; return 1; }
# Click at x, y; then wait (seconds, default 0.6).
click() { xdotool mousemove "$1" "$2" click 1; sleep "${3:-0.6}"; }
# A screenshot of the main window (or of the crop given as WxH+X+Y) to $SHOT_DIR/NAME.png.
shot() { import -window root -crop "${2:-640x460+480+285}" "$SHOT_DIR/$1.png"; }

# Start Xvfb and Hornresp, and wait (up to a minute: Wine's first start in a container is slow) for the input window.
# The first run ever shows a tip that hides the input window; Return closes it.
hr_start() {
  pgrep -x Xvfb >/dev/null || { Xvfb "$DISPLAY" -screen 0 1600x1000x24 >/dev/null 2>&1 & sleep 1; }
  (cd "$HR_DIR" && wine Hornresp.exe >/dev/null 2>&1 &)
  for i in $(seq 1 60); do
    [ -n "$(win 'Input Parameters')" ] && { wins; return 0; }
    [ "$i" = 20 ] && xdotool key Return
    sleep 1
  done
  echo "Hornresp did not open: $(wins | tr '\n' ',')"; return 1
}

# Stop Hornresp and the virtual display.
hr_stop() { wineserver -k 2>/dev/null; pkill -x Xvfb; }

# Go to the Input Parameters window through the Window menu.
to_input() { click 578 300; xdotool key 1; sleep 1; }

# Set Hornresp's air to the planner's (343 m/s, 1.18 kg/m³). A new container starts with Hornresp's defaults
# (344, 1.205). The input window's title shows the values when they are set.
hr_set_air() {
  to_input
  click 520 725 0.5                                                   # focus the input window
  xdotool key ctrl+F5
  wait_win '^Air Constants$' || { echo "no air dialog: $(wins | tr '\n' ',')"; return 1; }
  xdotool type --delay 30 "343.0"
  click 800 513 0.3; xdotool key Home shift+End; xdotool type --delay 30 "1.18"
  click 756 585 1.5                                                   # OK
  for _ in $(seq 1 25); do wins | grep -q "343.0 m/s" && { echo "air set"; return 0; }; sleep 0.2; done
  echo "air not set: $(wins | tr '\n' ',')"; return 1
}

# Import one record file. It must be the only file in Import/, so the dialog lists it first. Prints ok or error.
hr_import() {
  rm -f "$HR_DIR"/Import/*; cp "$1" "$HR_DIR/Import/"
  to_input
  click 496 300; click 520 534; click 770 534 1                      # File > Import > Hornresp Record
  if [ -n "$(win '^Confirm Changes$')" ]; then click 777 532 1; fi   # "No": don't save an edited record
  if ! wait_win '^Import Hornresp Record$'; then                       # one retry: a menu click can miss
    xdotool key Escape Escape; sleep 0.5; click 496 300; click 520 534; click 770 534 1
    wait_win '^Import Hornresp Record$' || { echo "no import dialog: $(wins | tr '\n' ',')"; return 1; }
  fi
  click 680 472 0.3; click 930 422 1.5                                # the first file, then Open
  if [ -n "$(win '^Error$')" ]; then                                  # "… is not a valid record"
    shot import-error 360x100+620+465; click 800 533
    [ -n "$(win '^Import Hornresp Record$')" ] && click 930 484       # Cancel
    echo "error"; return 1
  fi
  echo ok
}

# Calculate the current record with masked chamber resonances (lumped chambers, as the horn engine), and export all
# chart data to Export/NAME-data.txt.
hr_calc_export() {
  to_input
  click 1068 683 2                                                    # Calculate
  if wait_win '^Air Chamber Resonances$'; then click 695 533 4; fi   # "Yes": mask the chamber resonances
  for _ in $(seq 1 50); do [ -n "$(win 'Schematic Diagram|Acoustical Power')" ] && break; sleep 0.3; done
  click 578 300; xdotool key 4; sleep 2                               # Window > Acoustical Power
  click 496 300; click 520 320; click 645 320 1.5                     # File > Export > All Chart Data
  wait_win '^Export All Chart Data$' || { echo "no export dialog: $(wins | tr '\n' ',')"; return 1; }
  # Hornresp rejects long export names, so save as "out" and rename
  rm -f "$HR_DIR/Export/out.txt"
  xdotool type --delay 30 "out"; xdotool key Return; sleep 2
  if [ -n "$(win '^Error$')" ]; then
    shot export-error 360x110+620+460; click 800 533
    [ -n "$(win '^Export All Chart Data$')" ] && click 930 484
    echo "export error"; return 1
  fi
  mv "$HR_DIR/Export/out.txt" "$HR_DIR/Export/$1-data.txt" && echo "exported $1"
}

# Import, calculate and export one record: hr_run NAME RECORD.
hr_run() { [ "$(hr_import "$2")" = ok ] && hr_calc_export "$1"; }

# Hornresp's export as a test results file: frequency, SPL, Ze and Xd up to 2 kHz, tab-separated, LF.
hr_trim() {
  awk -F'\t' 'BEGIN{OFS="\t"} NR==1{print $1,$5,$6,$7; next} NF>5 && $1+0<=2000.5 {print $1,$5,$6,$7}' "$1" |
    sed 's/\r$//; s/ *\t/\t/g; s/ *$//'
}
