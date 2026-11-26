#!/bin/sh
set -eu
installer_dir=$(CDPATH='' cd "$(dirname "$0")" && pwd)
. "$installer_dir/copy-site.sh"

case "${XDG_DATA_HOME:-}" in
    /*) data_dir=$XDG_DATA_HOME ;;
    *) data_dir="$HOME/.local/share" ;;
esac
app="$data_dir/zhihu-reading-assistant"
desktop="$data_dir/applications/zhihu-reading-assistant.desktop"
prepare_install "$app"
copy_site "$app"
mkdir -p "$(dirname "$desktop")"
if [ -e "$desktop" ] && ! grep -qx 'X-Kanshan-Launcher=true' "$desktop"; then
    printf 'An unrelated launcher exists at %s\n' "$desktop" >&2
    exit 1
fi

# Desktop Entry decodes string escapes before interpreting quotes in Exec.
escaped=$(printf '%s' "$app/index.html" | sed 's/[\`"$\\]/\\&/g; s/\\/\\\\/g; s/%/%%/g')
cat > "$desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=看山陪读
Exec=xdg-open "$escaped"
Icon=web-browser
Terminal=false
Categories=Education;
X-Kanshan-Launcher=true
DESKTOP
chmod 755 "$desktop"
printf 'Installed: %s\n' "$desktop"
if [ "${1:-}" != '--no-open' ]; then xdg-open "$app/index.html"; fi
