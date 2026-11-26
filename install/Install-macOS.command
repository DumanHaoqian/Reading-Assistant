#!/bin/sh
set -eu
installer_dir=$(CDPATH='' cd "$(dirname "$0")" && pwd)
. "$installer_dir/copy-site.sh"

app="$HOME/Applications/Reading Assistant.app"
prepare_install "$app"
mkdir -p "$app/Contents/MacOS"
copy_site "$app/Contents/Resources/site"
cp "$installer_dir/Info.plist" "$app/Contents/Info.plist"
cat > "$app/Contents/MacOS/reading-assistant" <<'LAUNCH'
#!/bin/sh
exec /usr/bin/open "$(dirname "$0")/../Resources/site/index.html"
LAUNCH
chmod 755 "$app/Contents/MacOS/reading-assistant"
touch "$app"
printf 'Installed: %s\n' "$app"
if [ "${1:-}" != '--no-open' ]; then /usr/bin/open "$app"; fi
