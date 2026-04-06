#!/usr/bin/env python3
"""
Export the 4 ellipse layers + mask from Group 16.svg as aurora PNGs.
Each ellipse → white-on-transparent PNG at 3x.
Mask → white rounded rect with baked-in blur, R→alpha conversion.

Output: assets/aurora/counter/
"""

import os
import re
import math
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

SCALE = 3
BLUR_STD = 7.9 * 0.6  # Button multiplier: Figma 7.9 × 0.6 = 4.74
BLUR_PAD = math.ceil(BLUR_STD * 3)  # ~15px padding per side for shape blur
MASK_BLUR = 3  # Soft edge blur for mask (button-style)
MASK_PAD = MASK_BLUR * 3  # 9px

# Container = mask bbox
CONTAINER_W = 73
CONTAINER_H = 73
MASK_RX = 25

# Ellipse data from SVG: (cx, cy, rx, ry, rotation_deg)
ELLIPSES = [
    (36.5, 41.5, 17.5, 15.5, 0),         # E0: #FF0085
    (17.0037, 38.2328, 12.4707, 10.6001, 2.97363),  # E1: #FF00F5
    (58.8524, 57.0388, 10.0586, 6.63771, -59.1951),  # E2: #00BEAE
    (46, 16.5, 15, 8.5, 0),              # E3: #00FE96
]

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "aurora" / "counter"


def ellipse_bbox(cx, cy, rx, ry, angle_deg):
    """Compute axis-aligned bounding box of a rotated ellipse."""
    a = math.radians(angle_deg)
    cos_a, sin_a = math.cos(a), math.sin(a)
    # Half-extents after rotation
    hw = math.sqrt((rx * cos_a) ** 2 + (ry * sin_a) ** 2)
    hh = math.sqrt((rx * sin_a) ** 2 + (ry * cos_a) ** 2)
    return (cx - hw, cy - hh, cx + hw, cy + hh)


def make_shape_svg(idx, cx, cy, rx, ry, angle_deg):
    """Create an SVG string for a single white ellipse with blur, sized to its bbox + padding."""
    x1, y1, x2, y2 = ellipse_bbox(cx, cy, rx, ry, angle_deg)
    pad = BLUR_PAD
    vb_x = x1 - pad
    vb_y = y1 - pad
    vb_w = (x2 - x1) + 2 * pad
    vb_h = (y2 - y1) + 2 * pad

    rot = f' transform="rotate({angle_deg} {cx} {cy})"' if angle_deg != 0 else ''

    return f'''<svg xmlns="http://www.w3.org/2000/svg"
  width="{vb_w * SCALE}" height="{vb_h * SCALE}"
  viewBox="{vb_x} {vb_y} {vb_w} {vb_h}">
  <defs>
    <filter id="blur" filterUnits="userSpaceOnUse"
      x="{vb_x}" y="{vb_y}" width="{vb_w}" height="{vb_h}">
      <feGaussianBlur stdDeviation="{BLUR_STD}" />
    </filter>
  </defs>
  <g filter="url(#blur)">
    <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="white"{rot} />
  </g>
</svg>''', (vb_w, vb_h)


def make_mask_svg():
    """Create an SVG string for the mask: white rounded rect with baked-in blur."""
    pad = MASK_PAD
    vb_x = -pad
    vb_y = -pad
    vb_w = CONTAINER_W + 2 * pad
    vb_h = CONTAINER_H + 2 * pad

    return f'''<svg xmlns="http://www.w3.org/2000/svg"
  width="{vb_w * SCALE}" height="{vb_h * SCALE}"
  viewBox="{vb_x} {vb_y} {vb_w} {vb_h}">
  <defs>
    <filter id="maskBlur" filterUnits="userSpaceOnUse"
      x="{vb_x}" y="{vb_y}" width="{vb_w}" height="{vb_h}">
      <feGaussianBlur stdDeviation="{MASK_BLUR}" />
    </filter>
  </defs>
  <rect x="0" y="0" width="{CONTAINER_W}" height="{CONTAINER_H}"
    rx="{MASK_RX}" fill="white" filter="url(#maskBlur)" />
</svg>''', (vb_w, vb_h)


def render_png(page, svg_str, output_path, is_mask=False):
    """Render SVG to PNG using Playwright."""
    if is_mask:
        html = f'<html><body style="margin:0;padding:0;background:#000">{svg_str}</body></html>'
    else:
        html = f'<html><body style="margin:0;padding:0;background:transparent">{svg_str}</body></html>'

    page.set_content(html)
    svg_el = page.locator('svg')
    svg_el.wait_for()

    if is_mask:
        svg_el.screenshot(path=str(output_path), type='png')
        # Convert R channel to alpha (white on black → white with alpha)
        img = Image.open(output_path).convert('RGBA')
        r, g, b, a = img.split()
        # Use R as alpha, fill RGB with white
        white = Image.new('L', img.size, 255)
        Image.merge('RGBA', (white, white, white, r)).save(output_path)
    else:
        svg_el.screenshot(path=str(output_path), type='png', omit_background=True)

    print(f"  Exported: {output_path.name}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Container: {CONTAINER_W}x{CONTAINER_H}")
    print(f"Shape blur: stdDev={BLUR_STD:.2f}, pad={BLUR_PAD}")
    print(f"Mask blur: stdDev={MASK_BLUR}, pad={MASK_PAD}")
    print(f"Scale: {SCALE}x")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={'width': 800, 'height': 600},
            device_scale_factor=1,  # We handle scale via SVG width/height
        )

        # Export shape layers
        print("Exporting shape layers...")
        shape_info = []
        for i, (cx, cy, rx, ry, angle) in enumerate(ELLIPSES):
            svg_str, (logical_w, logical_h) = make_shape_svg(i, cx, cy, rx, ry, angle)
            out_path = OUTPUT_DIR / f"counter_e{i}.png"
            render_png(page, svg_str, out_path, is_mask=False)

            # Get actual PNG dimensions for verification
            img = Image.open(out_path)
            shape_info.append({
                'index': i,
                'center': (round(cx, 2), round(cy, 2)),
                'png_size': img.size,
                'logical_size': (round(logical_w, 2), round(logical_h, 2)),
            })

        # Export mask
        print("\nExporting mask...")
        mask_svg, (mask_lw, mask_lh) = make_mask_svg()
        mask_path = OUTPUT_DIR / "counter_mask.png"
        render_png(page, mask_svg, mask_path, is_mask=True)

        browser.close()

    # Print summary
    print("\n=== Summary ===")
    print(f"Container: {{ w: {CONTAINER_W}, h: {CONTAINER_H} }}")
    print(f"Mask padding: {MASK_PAD} (blur={MASK_BLUR})")
    print(f"\nShapes (for AuroraBackground DATA):")
    for s in shape_info:
        lw = round(s['logical_size'][0], 1)
        lh = round(s['logical_size'][1], 1)
        cx, cy = s['center']
        print(f"  [{cx}, {cy}, {lw}, {lh}],  // counter_e{s['index']}.png ({s['png_size'][0]}x{s['png_size'][1]}px @{SCALE}x)")

    print(f"\nColors (from SVG): ['#FF0085', '#FF00F5', '#00BEAE', '#00FE96']")
    print(f"\nFiles written to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()
