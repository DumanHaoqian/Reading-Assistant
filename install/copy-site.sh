# Sourced by both Unix installers. The browser stores the reader's settings.
source_dir=$(CDPATH='' cd "$installer_dir/.." && pwd)
if [ ! -f "$source_dir/index.html" ] || [ ! -f "$source_dir/home.html" ] || [ ! -f "$source_dir/assets/kanshan/official-frames.js" ]; then
    printf '%s\n' 'Extract the entire archive before installing.' >&2
    exit 1
fi

prepare_install() {
    if [ -e "$1" ] && [ ! -f "$1/.kanshan-install" ]; then
        printf 'An unrelated file or folder exists at %s\n' "$1" >&2
        exit 1
    fi
    mkdir -p "$1"
    : > "$1/.kanshan-install"
}

copy_site() {
    mkdir -p "$1/assets"
    cp -R "$source_dir/assets/." "$1/assets/"
    cp "$source_dir"/*.js "$source_dir"/*.css "$1/"
    cp "$source_dir/index.html" "$source_dir/home.html" "$1/"
}
