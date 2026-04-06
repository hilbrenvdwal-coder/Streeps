#!/usr/bin/env python3
"""
Export login aurora shapes from Login screen.svg as individual white-on-transparent PNGs.
Uses Playwright (headless Chromium) for pixel-perfect SVG rendering with blur filters.

Usage: python scripts/export_login_aurora.py
"""

import xml.etree.ElementTree as ET
import re
import os
import sys
import json
import tempfile
from playwright.sync_api import sync_playwright

SCALE = 3
SVG_PATH = os.path.join(os.path.dirname(__file__), '..', 'Login screen.svg')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'aurora', 'login')
BLUR_STD = 44.15


def strip_ns(tag):
    return tag.split('}')[-1] if '}' in tag else tag


def elem_to_svg_str(elem):
    raw = ET.tostring(elem, encoding='unicode')
    raw = re.sub(r'<ns\d+:', '<', raw)
    raw = re.sub(r'</ns\d+:', '</', raw)
    raw = re.sub(r'\s+xmlns:ns\d+="[^"]*"', '', raw)
    return raw


def get_path_bbox(d_attr):
    if not d_attr:
        return None
    tokens = re.findall(r'[MmLlCcSsQqTtAaHhVvZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d_attr)
    xs, ys = [], []
    cx, cy = 0, 0
    i = 0
    cmd = 'M'

    def next_num():
        nonlocal i
        while i < len(tokens) and re.match(r'[A-Za-z]', tokens[i]):
            i += 1
        if i < len(tokens):
            val = float(tokens[i]); i += 1; return val
        return 0

    while i < len(tokens):
        if re.match(r'[A-Za-z]', tokens[i]):
            cmd = tokens[i]; i += 1
        if cmd in ('M', 'L'):
            cx, cy = next_num(), next_num(); xs.append(cx); ys.append(cy)
            if cmd == 'M': cmd = 'L'
        elif cmd in ('m', 'l'):
            cx += next_num(); cy += next_num(); xs.append(cx); ys.append(cy)
            if cmd == 'm': cmd = 'l'
        elif cmd == 'H': cx = next_num(); xs.append(cx); ys.append(cy)
        elif cmd == 'h': cx += next_num(); xs.append(cx); ys.append(cy)
        elif cmd == 'V': cy = next_num(); xs.append(cx); ys.append(cy)
        elif cmd == 'v': cy += next_num(); xs.append(cx); ys.append(cy)
        elif cmd == 'C':
            for _ in range(3): px, py = next_num(), next_num(); xs.append(px); ys.append(py)
            cx, cy = xs[-1], ys[-1]
        elif cmd == 'c':
            for j in range(3):
                dx, dy = next_num(), next_num(); px, py = cx + dx, cy + dy; xs.append(px); ys.append(py)
                if j == 2: cx, cy = px, py
        elif cmd in ('Z', 'z'): pass
        else:
            try: next_num()
            except: i += 1

    if not xs or not ys: return None
    return {'x': min(xs), 'y': min(ys), 'width': max(xs) - min(xs), 'height': max(ys) - min(ys)}


def build_shape_svg(d_attr, blur_std, scale):
    """Build a minimal SVG with one white path + blur filter."""
    ns = 'http://www.w3.org/2000/svg'
    bbox = get_path_bbox(d_attr)
    if not bbox:
        return None, None

    blur_pad = blur_std * 3
    x = bbox['x'] - blur_pad
    y = bbox['y'] - blur_pad
    w = bbox['width'] + blur_pad * 2
    h = bbox['height'] + blur_pad * 2
    pw = int(w * scale)
    ph = int(h * scale)
    vb = f"{x} {y} {w} {h}"

    svg = f'''<svg xmlns="{ns}" width="{pw}" height="{ph}" viewBox="{vb}">
<defs>
  <filter id="blur" filterUnits="userSpaceOnUse" x="{x}" y="{y}" width="{w}" height="{h}">
    <feGaussianBlur in="SourceGraphic" stdDeviation="{blur_std}"/>
  </filter>
</defs>
<g filter="url(#blur)">
  <path d="{d_attr}" fill="#FFFFFF"/>
</g>
</svg>'''

    center = {
        'x': round(bbox['x'] + bbox['width'] / 2, 2),
        'y': round(bbox['y'] + bbox['height'] / 2, 2),
    }
    size = {
        'width': round(w, 2),
        'height': round(h, 2),
    }

    return svg, {'center': center, 'png_size': size}


def render_svg_to_png(page, svg_content, output_path):
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False, mode='w', encoding='utf-8') as f:
        f.write(svg_content)
        tmp_path = f.name

    try:
        file_url = 'file:///' + tmp_path.replace('\\', '/').replace(' ', '%20')
        page.goto(file_url)
        page.wait_for_load_state('networkidle')
        svg_el = page.locator('svg')
        svg_el.screenshot(path=output_path, type='png', omit_background=True)
    finally:
        os.unlink(tmp_path)


def main():
    svg_path = SVG_PATH
    if len(sys.argv) > 1:
        svg_path = sys.argv[1]

    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Find the aurora filter group (filter0_f_65_11)
    aurora_paths = []
    for elem in root.iter():
        filter_ref = elem.get('filter')
        if filter_ref and 'filter0_f' in filter_ref:
            # This is the aurora group — collect child paths
            for child in elem:
                if strip_ns(child.tag) == 'path':
                    d = child.get('d', '')
                    fill = child.get('fill', '#FFFFFF')
                    aurora_paths.append({'d': d, 'fill': fill})
            break

    if not aurora_paths:
        print('No aurora paths found!')
        sys.exit(1)

    print(f'Found {len(aurora_paths)} aurora paths')

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Build SVGs and extract positions
    positions = []
    render_jobs = []

    for i, path in enumerate(aurora_paths):
        svg_content, pos_data = build_shape_svg(path['d'], BLUR_STD, SCALE)
        if svg_content is None:
            continue

        out_path = os.path.join(OUTPUT_DIR, f'login_p{i}.png')
        render_jobs.append((svg_content, out_path))
        positions.append({
            'index': i,
            'fill': path['fill'],
            **pos_data,
        })
        print(f'  Shape {i}: fill={path["fill"]}, center=({pos_data["center"]["x"]}, {pos_data["center"]["y"]}), size={pos_data["png_size"]["width"]:.0f}x{pos_data["png_size"]["height"]:.0f}')

    # Render with Playwright
    print(f'\nRendering {len(render_jobs)} PNGs at {SCALE}x...')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for svg_content, out_path in render_jobs:
            render_svg_to_png(page, svg_content, out_path)
            print(f'  Exported: {os.path.basename(out_path)}')

        browser.close()

    # Save positions JSON
    # Container = the clipped region (390x500 visible area, accounting for the two clusters)
    container = {'w': 590, 'h': 500}
    data = {
        'container': container,
        'maskPad': 0,
        'shapes': [],
    }
    for pos in positions:
        data['shapes'].append([
            pos['center']['x'],
            pos['center']['y'],
            round(pos['png_size']['width']),
            round(pos['png_size']['height']),
        ])

    json_path = os.path.join(OUTPUT_DIR, 'login_data.json')
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f'\nPositions written to: {json_path}')
    print('\nDone! Add these to AuroraBackground.tsx SRC/DATA sections.')


if __name__ == '__main__':
    main()
