"""Build the portable demo from a checkout: python scripts/package-demo.py."""

from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
NAME = "Reading-Assistant"
OUTPUT = ROOT / "dist" / (NAME + ".zip")


def bundle_files():
    files = [ROOT / "index.html", ROOT / "home.html", ROOT / "README.md"]
    files.extend(ROOT.glob("*.css"))
    files.extend(ROOT.glob("*.js"))
    for folder in (ROOT / "assets", ROOT / "install"):
        if not folder.is_dir():
            raise FileNotFoundError(folder)
        for path in folder.rglob("*"):
            parts = path.relative_to(folder).parts
            if path.is_file() and not any(part.startswith(".") for part in parts):
                files.append(path)
    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def main():
    files = bundle_files()
    OUTPUT.parent.mkdir(exist_ok=True)
    with NamedTemporaryFile(dir=OUTPUT.parent, suffix=".tmp", delete=False) as temp:
        temporary_zip = Path(temp.name)
    try:
        with ZipFile(temporary_zip, "w") as archive:
            for path in files:
                entry = ZipInfo(NAME + "/" + path.relative_to(ROOT).as_posix())
                # Record Unix modes even when the release is built on Windows.
                entry.create_system = 3
                executable = path.suffix in (".command", ".sh")
                entry.external_attr = (0o100755 if executable else 0o100644) << 16
                archive.writestr(entry, path.read_bytes(), compress_type=ZIP_DEFLATED)
        temporary_zip.replace(OUTPUT)
    finally:
        if temporary_zip.exists():
            temporary_zip.unlink()
    print(f"Created dist/{OUTPUT.name} ({len(files)} files, {OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
