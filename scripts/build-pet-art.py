"""Build the web companion from the Zhihu S3 IP download.

Usage: python scripts/build-pet-art.py path/to/kanshan_material.zip
Requires Pillow, numpy and scipy. All actor frames, including the eye textures,
come from the archive. Render at 20 fps; center the eye layer to recover the
supplied frame, or offset it slightly to look toward the pointer.
"""

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

import numpy as np
from PIL import Image
from scipy import ndimage


PACKAGE_SHA = "c496d6f229445d582feda364903b4a92018292fc2928f5c15c506fffdce6b499"
SIZE = 192
EYE_CELL = 20
COLUMNS = 10
CLIPS = {"idle": "待机", "wave": "打招呼", "sway": "晃悠"}


def archive_name(entry):
    if entry.flag_bits & 0x800:
        return entry.filename
    return entry.filename.encode("cp437").decode("utf-8")


def open_eyes(source):
    """Find black components inside the head; leave slit-shaped eyelids intact."""
    rgba = np.asarray(source)
    dark = (rgba[:, :, :3].mean(axis=2) < 120) & (rgba[:, :, 3] > 127)
    labels, _ = ndimage.label(dark, structure=np.ones((3, 3)))
    found = []
    for y, x in ndimage.find_objects(labels):
        w, h = x.stop - x.start, y.stop - y.start
        if not (55 < x.start < x.stop < 240 and 65 < y.start < y.stop < 169):
            continue
        if 3 <= w <= 22 and 8 <= h <= 21 and h >= 0.72 * w:
            found.append((x.start, y.start, x.stop, y.stop))
    return sorted(found)


def separate_eye(frame, box):
    """Use the adjacent white fur as a background plate. Its inverse alpha
    composite captures the original eye, down to its existing soft edges."""
    x0, y0, x1, y1 = (n * SIZE / 320 for n in box)
    xmin, ymin = math.floor(x0) - 4, math.floor(y0) - 4
    xmax, ymax = math.ceil(x1) + 4, math.ceil(y1) + 4
    w, h = xmax - xmin, ymax - ymin
    assert max(w, h) <= EYE_CELL
    # Work in a local window with extra fur on all sides of the eye.
    margin = 8
    region = frame[ymin-margin:ymax+margin, xmin-margin:xmax+margin]
    rgb = region[:, :, :3].astype(np.float64)
    yy, xx = np.indices(rgb.shape[:2])
    cx, cy = margin + (x0 + x1) / 2 - xmin - .5, margin + (y0 + y1) / 2 - ymin - .5
    distance = np.hypot((xx - cx) / ((x1-x0)/2+3), (yy-cy) / ((y1-y0)/2+3))
    # Normalize the blur by valid fur pixels. Transparent GIF boundaries cannot
    # bleed black into the small far-side eye when the head turns toward camera.
    fur = (distance >= 1) & (region[:, :, 3] == 255)
    weights = ndimage.gaussian_filter(fur.astype(float), 4)
    smooth_fur = ndimage.gaussian_filter(rgb * fur[:, :, None], (4, 4, 0))
    smooth_fur /= np.maximum(weights[:, :, None], 1e-8)
    fade = np.clip((1-distance)*6, 0, 1) * (region[:, :, 3] == 255)
    plate = np.rint(rgb + (smooth_fur - rgb) * fade[:, :, None]).clip(0, 255)
    # Choose the smallest opacity that can reproduce the original RGB. This
    # makes an eye-only cutout, so a moving patch never carries a white square.
    darken = (plate-rgb) / np.maximum(plate, 1)
    lighten = (rgb-plate) / np.maximum(255-plate, 1)
    opacity = np.ceil(np.maximum(darken, lighten).max(axis=2)*255).clip(0, 255)
    color = plate + (rgb-plate)*255 / np.maximum(opacity[:, :, None], 1)
    central = np.s_[margin:margin+h, margin:margin+w]
    patch = np.dstack((np.rint(color).clip(0, 255), opacity))[central].astype('uint8')
    region[central][:, :, :3] = plate[central].astype('uint8')
    return [xmin, ymin, w, h], Image.fromarray(patch)


def atlas(frames, cell):
    result = Image.new("RGBA", (COLUMNS * cell, math.ceil(len(frames)/COLUMNS) * cell))
    for i, frame in enumerate(frames):
        if frame is not None:
            result.paste(frame, ((i % COLUMNS) * cell, (i // COLUMNS) * cell))
    return result


def encode(image, path):
    image.save(path, "WEBP", lossless=True, method=4)


def build_clip(animation, key, output):
    bodies, eyes, extra_eyes = [], [], []
    frames, far = [], {}
    for i in range(animation.n_frames):
        animation.seek(i)
        original = animation.convert("RGBA")
        assert original.size == (320, 320) and animation.info["duration"] == 50
        reduced = original.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        pixels = np.array(reduced)
        primary = None
        primary_box = None
        patches = []
        for index, box in enumerate(open_eyes(original)):
            position, cutout = separate_eye(pixels, box)
            patches.append((position, cutout))
            if index == 0:
                primary, primary_box = cutout, position
            else:
                far[i] = position + [animation.n_frames + len(extra_eyes)]
                extra_eyes.append(cutout)
        body = Image.fromarray(pixels)
        rebuilt = body.copy()
        for position, cutout in patches:
            rebuilt.alpha_composite(cutout, tuple(position[:2]))
        error = np.abs(np.asarray(rebuilt, dtype=np.int16)-np.asarray(reduced, dtype=np.int16))
        if error.max() > 1:
            raise ValueError(f"{key}[{i}] eye reconstruction error: {error.max()}")
        if i == 0 and key == 'idle':
            encode(reduced, output / 'official-idle-poster.webp')
        bodies.append(body)
        eyes.append(primary)
        frames.append(primary_box)
    base = f"official-{key}"
    encode(atlas(bodies, SIZE), output / (base + ".webp"))
    eyes.extend(extra_eyes)
    encode(atlas(eyes, EYE_CELL), output / (base + "-eyes.webp"))
    return {
        'atlas': f'assets/kanshan/{base}.webp',
        'eyes': f'assets/kanshan/{base}-eyes.webp',
        'eyeCell': EYE_CELL, 'eyeRows': math.ceil(len(eyes)/COLUMNS),
        'frames': frames, 'farEyes': far,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1]/"assets"/"kanshan")
    args = parser.parse_args()
    package = args.archive.read_bytes()
    if hashlib.sha256(package).hexdigest() != PACKAGE_SHA:
        parser.error("The archive does not match the Zhihu S3 artwork used by this project.")
    args.out.mkdir(exist_ok=True, parents=True)
    art = {'size': SIZE, 'columns': COLUMNS, 'fps': 20, 'clips': {}}
    with zipfile.ZipFile(io.BytesIO(package)) as z:
        for key, role in CLIPS.items():
            entry = next(e for e in z.infolist()
                         if archive_name(e).startswith(f"刘看山素材/刘看山动态/{role}_"))
            with Image.open(io.BytesIO(z.read(entry))) as animation:
                art['clips'][key] = build_clip(animation, key, args.out)
                print(f"{key}: verified {animation.n_frames} original frames")
    content = json.dumps(art, separators=(',', ':'))
    (args.out/"official-frames.js").write_text(
        f"// Generated by scripts/build-pet-art.py from the Zhihu S3 IP archive.\nwindow.KanshanOfficialArt={content};\n",
        encoding="utf8",
    )


if __name__ == "__main__":
    main()
