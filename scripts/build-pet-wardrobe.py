"""Fit two cloth textures to the bundled Zhihu sprite sheets. Run from any folder.

Requires numpy, scipy and Pillow. The overlay atlases share the original frame
layout. Their alpha preserves the paws and tail in front of the fabric.
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy import ndimage

ART = Path(__file__).resolve().parents[1] / "assets" / "kanshan"
OUTFITS = ("scarf", "vest")
TILE = 192
SAMPLING = 2
Y, X = (np.indices((TILE * SAMPLING, TILE * SAMPLING)) + 0.5) / SAMPLING - 0.5


def torso_coordinates(frame):
    rgba = np.asarray(frame, dtype=float)
    light = rgba[:, :, :3].mean(axis=2)
    fur = (rgba[:, :, 3] > 150) & (light > 112)
    # Eroding separates the broad torso from the small round tail.
    yy, xx = np.ogrid[-8:9, -8:9]
    disk = xx * xx + yy * yy <= 64
    labels, _ = ndimage.label(ndimage.binary_erosion(fur, disk))
    core = labels == np.bincount(labels.ravel())[1:].argmax() + 1
    torso = ndimage.binary_dilation(core, disk)
    ty, tx = np.nonzero(torso)
    # Track the head above the muzzle and the front of the lower body. Using
    # the fur centroid here would tilt the collar towards the tail as it sways.
    head_y = ty.min() + 23
    hip_y = np.quantile(ty, .79)
    head_x = np.median(tx[np.abs(ty - head_y) < 3])
    hip_x = np.quantile(tx[np.abs(ty - hip_y) < 3], .98) - 32
    angle = np.arctan2(hip_x - head_x, hip_y - head_y)
    cosine, sine = np.cos(angle), np.sin(angle)
    row = np.rint(ty * cosine + tx * sine).astype(int)
    col = tx * cosine - ty * sine
    left = np.array([col[row == r].min() for r in np.unique(row)])
    right = np.array([col[row == r].max() for r in np.unique(row)])
    across = X * cosine - Y * sine
    down = Y * cosine + X * sine
    left_edge = np.interp(down, np.unique(row), ndimage.median_filter(left, size=5))
    right_edge = np.interp(down, np.unique(row), ndimage.median_filter(right, size=5))
    hem = np.quantile(row, .997) - 3.0
    neck = hem - 53.0
    v = (down - neck) / (hem - neck)
    # The waving/swaying tail sometimes touches the body's rear silhouette.
    # Limit the panel to the torso, tapering towards the haunches.
    max_width = np.interp(v, [-.2,.2,.48,.66,.8,1], [69,71,73,72,68,54])
    left_edge = np.maximum(left_edge, right_edge - max_width)
    u = (across - left_edge) / np.maximum(1, right_edge - left_edge)
    opacity = ndimage.map_coordinates(rgba[:, :, 3] / 255, [Y, X], order=1)
    luminance = ndimage.map_coordinates(light, [Y, X], order=1)
    # Feather edges where black arms/legs occlude the knitted surface.
    opacity *= np.clip((luminance - 38) / 77, 0, 1)
    return u, v, luminance, opacity


def fabric(kind, u, v, luminance, opacity):
    colors = np.zeros((*u.shape, 3))
    alpha = np.zeros_like(u, dtype=bool)
    # The face and chest point slightly to the right of the camera.
    front = .66
    if kind == "scarf":
        curve = .09 * np.sin(np.pi * np.clip(u, 0, 1)) + .03 * u
        height = v - curve
        band = (height > -.115) & (height < .105) & (u > -.015) & (u < 1.013)
        tail_u = u - (.55 - .24 * v)
        tail_v = .62 + .10 * (tail_u + .08) / .19
        fringe = .041 * (np.cos(tail_u * 186) > -.25)
        tail = (abs(tail_u) < .094) & (v > .06) & (v < tail_v + fringe)
        knot = ((u - .525) / .12) ** 2 + ((v - .16) / .105) ** 2 < 1
        alpha = band | tail | knot
        colors[:] = [197, 66, 47]
        colors[tail] = [177, 49, 39]
        colors[tail & ((abs(v - tail_v + .10) < .026) | (abs(v - tail_v + .17) < .012))] = [251, 208, 148]
        colors[band] = [205, 65, 45]
        colors[band & (abs(height + .074) < .012)] = [225, 115, 76]
        colors[band & (height > .075)] = [175, 49, 37]
        colors[knot] = [217, 76, 52]
        folds = 1 + .06 * np.cos(height * 41) * band - .08 * np.cos(tail_u * 46) * tail
    else:
        neckline = np.interp(u, [0,.18,.35,front,.90,1], [.045,-.04,-.02,.26,-.023,.035])
        armhole = .06 + .31 * np.sqrt(np.clip(1 - ((u - .045) / .16) ** 2, 0, 1))
        shoulder = np.where(u < .22, np.maximum(neckline, armhole), neckline)
        hem = .89 + .055 * np.sin(np.pi * np.clip(u,0,1))
        alpha = (u >= -.005) & (u <= 1.005) & (v >= shoulder) & (v < hem)
        colors[:] = [50, 112, 149]
        colors[(v < shoulder + .053) | (v > hem - .11)] = [37, 77, 108]
        colors[(v > shoulder + .045) & (v < shoulder + .065)] = [225, 213, 165]
        # One argyle motif and fine crossing stitches on the front of the vest.
        diamonds = np.abs((u - front) / .16) + np.abs((v - .56) / .21)
        colors[diamonds < 1] = [226, 214, 166]
        for center in (front - .24, front + .24):
            stitch = np.abs((u - center) / .23) + np.abs((v - .56) / .24)
            colors[(abs(stitch - 1) < .055) & (v > .295) & (v < .82)] = [153, 189, 196]
        folds = 1 - .035 * np.cos(u * 18 + v * 1.2)
    # Lighting comes from the matching frame; low-contrast ribs suggest yarn at 3x.
    shade = (.82 + .18 * np.sin(np.pi * np.clip(u, 0, 1))) * np.clip(luminance / 229, .56, 1.08)
    knit = 1 + .014 * np.cos(u * 230 + .65 * np.cos(v * 112)) + .009 * np.cos(v * 160)
    rgb = np.clip(colors * (shade * folds * knit)[:, :, None], 0, 255)
    rgba = np.dstack((rgb, alpha * opacity * 255)).astype(np.uint8)
    return Image.fromarray(rgba).resize((TILE, TILE), Image.Resampling.LANCZOS)


def main():
    metadata = json.loads((ART / "official-frames.js").read_text().split("OfficialArt=")[1].rstrip(";\n"))
    cols = metadata["columns"]
    for pose, clip in metadata["clips"].items():
        actor = Image.open(ART / Path(clip["atlas"]).name).convert("RGBA")
        clothes = {kind: Image.new("RGBA", actor.size) for kind in OUTFITS}
        for i in range(len(clip["frames"])):
            x, y = i % cols * TILE, i // cols * TILE
            coords = torso_coordinates(actor.crop((x, y, x + TILE, y + TILE)))
            for kind in OUTFITS:
                garment = fabric(kind, *coords)
                clothes[kind].paste(garment, (x, y))
                if pose == "idle" and i == 0:
                    poster = Image.open(ART / "official-idle-poster.webp").convert("RGBA")
                    poster.alpha_composite(garment)
                    poster.save(ART / f"wardrobe-{kind}-poster.webp", lossless=True)
        for kind, atlas in clothes.items():
            atlas.save(ART / f"wardrobe-{kind}-{pose}.webp", lossless=True)
        print(f"Fitted {pose}: {len(clip['frames'])} frames", flush=True)


if __name__ == "__main__":
    main()
