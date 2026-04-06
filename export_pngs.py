#!/usr/bin/env python3
"""
Export aurora shapes from a fixed Figma SVG as individual white-on-transparent PNGs.
Uses Playwright (headless Chromium) for pixel-perfect SVG rendering with blur filters.

Each shape is isolated into a temp SVG at the mask bounding box viewBox, rendered to PNG.

Usage: python export_pngs.py <input.svg> [--output-dir ./assets/aurora] [--scale 3]
"""

import xml.etree.ElementTree as ET
import re
import os
import sys
import tempfile
from playwright.sync_api import sync_playwright

SCALE = 3
OUTPUT_DIR = './assets/aurora'


def strip_ns(tag):
    return tag.split('}')[-1] if '}' in tag else tag


def elem_to_svg_str(elem):
    """Convert an ElementTree element to SVG string without namespace prefixes."""
    raw = ET.tostring(elem, encoding='unicode')
    # Remove namespace prefixes like ns0: and xmlns:ns0="..."
    raw = re.sub(r'<ns\d+:', '<', raw)
    raw = re.sub(r'</ns\d+:', '</', raw)
    raw = re.sub(r'\s+xmlns:ns\d+="[^"]*"', '', raw)
    return raw


def find_filter_for_element(element, parent_map, root):
    """Find the blur filter element applied to this shape's parent <g>."""
    parent = parent_map.get(element)
    while parent is not None:
        filter_ref = parent.get('filter')
        if filter_ref:
            fid_match = re.search(r'url\(#([^)]+)\)', filter_ref)
            if fid_match:
                fid = fid_match.group(1)
                for elem in root.iter():
                    if strip_ns(elem.tag) == 'filter' and elem.get('id') == fid:
                        return elem
        if parent.get('mask'):
            break
        parent = parent_map.get(parent)
    return None


def get_blur_std(filter_elem):
    """Extract stdDeviation from a filter element."""
    if filter_elem is None:
        return 0
    for child in filter_elem.iter():
        if strip_ns(child.tag) == 'feGaussianBlur':
            return float(child.get('stdDeviation', 0))
    return 0


def get_ellipse_bbox(elem):
    """Calculate the transformed bounding box of an ellipse with matrix transform."""
    import math
    cx = float(elem.get('cx', 0))
    cy = float(elem.get('cy', 0))
    rx = float(elem.get('rx', 0))
    ry = float(elem.get('ry', 0))

    transform_str = elem.get('transform')
    if not transform_str:
        return {'x': cx - rx, 'y': cy - ry, 'width': 2 * rx, 'height': 2 * ry}

    # Parse matrix
    vals = [float(v) for v in re.findall(
        r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', transform_str
    )]
    if len(vals) < 6:
        return {'x': cx - rx, 'y': cy - ry, 'width': 2 * rx, 'height': 2 * ry}

    a, b, c, d, e, f = vals[:6]

    # Sample points around the ellipse to find the bounding box after transform
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    for i in range(64):
        angle = 2 * math.pi * i / 64
        px = cx + rx * math.cos(angle)
        py = cy + ry * math.sin(angle)
        tx = a * px + c * py + e
        ty = b * px + d * py + f
        min_x = min(min_x, tx)
        min_y = min(min_y, ty)
        max_x = max(max_x, tx)
        max_y = max(max_y, ty)

    return {'x': min_x, 'y': min_y, 'width': max_x - min_x, 'height': max_y - min_y}


def get_path_bbox(d_attr):
    """Estimate bounding box from SVG path d attribute."""
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
        if cmd in ('M','L'):
            cx,cy = next_num(),next_num(); xs.append(cx); ys.append(cy)
            if cmd=='M': cmd='L'
        elif cmd in ('m','l'):
            cx+=next_num(); cy+=next_num(); xs.append(cx); ys.append(cy)
            if cmd=='m': cmd='l'
        elif cmd=='H': cx=next_num(); xs.append(cx); ys.append(cy)
        elif cmd=='h': cx+=next_num(); xs.append(cx); ys.append(cy)
        elif cmd=='V': cy=next_num(); xs.append(cx); ys.append(cy)
        elif cmd=='v': cy+=next_num(); xs.append(cx); ys.append(cy)
        elif cmd=='C':
            for _ in range(3): px,py=next_num(),next_num(); xs.append(px); ys.append(py)
            cx,cy=xs[-1],ys[-1]
        elif cmd=='c':
            for j in range(3):
                dx,dy=next_num(),next_num(); px,py=cx+dx,cy+dy; xs.append(px); ys.append(py)
                if j==2: cx,cy=px,py
        elif cmd=='S':
            for _ in range(2): px,py=next_num(),next_num(); xs.append(px); ys.append(py)
            cx,cy=xs[-1],ys[-1]
        elif cmd=='s':
            for j in range(2):
                dx,dy=next_num(),next_num(); px,py=cx+dx,cy+dy; xs.append(px); ys.append(py)
                if j==1: cx,cy=px,py
        elif cmd in ('Z','z'): pass
        else:
            try: next_num()
            except: i+=1
    if not xs or not ys: return None
    return {'x': min(xs), 'y': min(ys), 'width': max(xs)-min(xs), 'height': max(ys)-min(ys)}


def get_shape_bbox(shape_elem):
    """Get the bounding box of any shape element (ellipse or path)."""
    tag = strip_ns(shape_elem.tag)
    if tag == 'ellipse':
        return get_ellipse_bbox(shape_elem)
    elif tag == 'path':
        return get_path_bbox(shape_elem.get('d', ''))
    return None


def build_shape_svg(shape_elem, filter_elem, mask_bbox, scale):
    """Build a minimal SVG with one white shape + blur filter.
    ViewBox is the shape's own bounding box + blur padding (minimal size)."""
    ns = 'http://www.w3.org/2000/svg'

    # Get the shape's own bounding box
    shape_bbox = get_shape_bbox(shape_elem)
    if not shape_bbox:
        shape_bbox = mask_bbox  # fallback

    # Add blur padding around the shape bbox
    blur_pad = get_blur_std(filter_elem) * 3
    x = shape_bbox['x'] - blur_pad
    y = shape_bbox['y'] - blur_pad
    w = shape_bbox['width'] + blur_pad * 2
    h = shape_bbox['height'] + blur_pad * 2
    pw = int(w * scale)
    ph = int(h * scale)
    vb = f"{x} {y} {w} {h}"

    parts = [f'<svg xmlns="{ns}" width="{pw}" height="{ph}" viewBox="{vb}">']

    # Add filter definition
    if filter_elem is not None:
        filter_str = elem_to_svg_str(filter_elem)
        parts.append(f'<defs>{filter_str}</defs>')
        filter_id = filter_elem.get('id')
        parts.append(f'<g filter="url(#{filter_id})">')
    else:
        parts.append('<g>')

    # Add shape with white fill (preserve transform)
    shape_str = elem_to_svg_str(shape_elem)
    shape_str = re.sub(r'fill="[^"]*"', 'fill="#FFFFFF"', shape_str)
    if 'fill=' not in shape_str:
        shape_str = shape_str.replace('/>', ' fill="#FFFFFF"/>', 1)
    parts.append(shape_str)

    parts.append('</g></svg>')
    return ''.join(parts)


def build_mask_svg(mask_elem, mask_bbox, scale, blur_std=3):
    """Build a minimal SVG string with the mask shape + blur baked in.
    Always adds blur filter with the specified stdDeviation."""
    ns = 'http://www.w3.org/2000/svg'

    blur_pad = blur_std * 3
    x = mask_bbox['x'] - blur_pad
    y = mask_bbox['y'] - blur_pad
    w = mask_bbox['width'] + blur_pad * 2
    h = mask_bbox['height'] + blur_pad * 2
    pw = int(w * scale)
    ph = int(h * scale)
    vb = f"{x} {y} {w} {h}"

    parts = [f'<svg xmlns="{ns}" width="{pw}" height="{ph}" viewBox="{vb}">']
    # Use userSpaceOnUse with absolute pixel values covering the entire expanded viewBox
    parts.append(f'<defs><filter id="maskBlur" filterUnits="userSpaceOnUse" x="{x}" y="{y}" width="{w}" height="{h}">')
    parts.append(f'<feGaussianBlur in="SourceGraphic" stdDeviation="{blur_std}"/></filter></defs>')

    # Find shape inside mask, set fill white, apply blur filter
    for child in mask_elem:
        tag = strip_ns(child.tag)
        if tag in ('path', 'rect', 'circle', 'ellipse'):
            shape_str = elem_to_svg_str(child)
            shape_str = re.sub(r'fill="[^"]*"', 'fill="#FFFFFF"', shape_str)
            shape_str = re.sub(r' filter="[^"]*"', '', shape_str)  # remove existing filter ref
            # Add our blur filter
            if shape_str.rstrip().endswith('/>'):
                shape_str = shape_str.rstrip()[:-2] + ' filter="url(#maskBlur)" />'
            else:
                shape_str = shape_str.replace('<path ', '<path filter="url(#maskBlur)" ', 1)
            parts.append(shape_str)
            break

    parts.append('</svg>')
    return ''.join(parts)


COMP_NAMES = {
    'mask0_71_41': 'drankenlijst',
    'mask1_71_41': 'cat4',
    'mask2_71_41': 'cat3',
    'mask3_71_41': 'speciaal',
    'mask4_71_41': 'normaal',
    'mask5_71_41': 'leden',
}

# Per-mask blur for export (baked into the mask PNG)
# Category buttons: subtle blur, Headers: stronger blur for soft transitions
MASK_BLUR = {
    'drankenlijst': 20,
    'cat4': 3,
    'cat3': 3,
    'speciaal': 3,
    'normaal': 3,
    'leden': 20,
}


def render_svg_to_png(page, svg_content, output_path, is_mask=False):
    """Render SVG string to PNG using Playwright.
    For masks: don't omit background (white shape would become transparent).
    Instead, render on black background so the white shape is visible in alpha."""
    with tempfile.NamedTemporaryFile(suffix='.html' if is_mask else '.svg', delete=False, mode='w', encoding='utf-8') as f:
        if is_mask:
            # Wrap mask SVG in HTML with black background, then we extract alpha from the result
            f.write(f'<!DOCTYPE html><html><body style="margin:0;background:#000">{svg_content}</body></html>')
        else:
            f.write(svg_content)
        tmp_path = f.name

    try:
        file_url = 'file:///' + tmp_path.replace('\\', '/').replace(' ', '%20')
        page.goto(file_url)
        page.wait_for_load_state('networkidle')

        svg_el = page.locator('svg')
        if is_mask:
            # Screenshot without omit_background — white shape on black bg
            svg_el.screenshot(path=output_path, type='png')
            # Convert: use red channel as alpha (white=opaque, black=transparent)
            from PIL import Image
            img = Image.open(output_path).convert('RGBA')
            r, g, b, a = img.split()
            # White shape -> full alpha, black bg -> zero alpha
            white_mask = Image.merge('RGBA', (r, g, b, r))  # use R as alpha
            white_mask.save(output_path)
        else:
            svg_el.screenshot(path=output_path, type='png', omit_background=True)
    finally:
        os.unlink(tmp_path)


def process_svg(svg_path, output_dir, scale):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    parent_map = {c: p for p in root.iter() for c in p}

    # Collect all SVGs to render
    render_jobs = []

    # Process masked groups
    for elem in root.iter():
        mask_ref = elem.get('mask')
        if not mask_ref:
            continue
        mask_match = re.search(r'url\(#([^)]+)\)', mask_ref)
        if not mask_match:
            continue
        mask_id = mask_match.group(1)
        comp_name = COMP_NAMES.get(mask_id, mask_id)

        # Find mask element
        mask_elem = None
        for m in root.iter():
            if strip_ns(m.tag) == 'mask' and m.get('id') == mask_id:
                mask_elem = m
                break
        if mask_elem is None:
            continue

        mask_bbox = {
            'x': float(mask_elem.get('x', 0)),
            'y': float(mask_elem.get('y', 0)),
            'width': float(mask_elem.get('width', 0)),
            'height': float(mask_elem.get('height', 0)),
        }

        print(f'Component: {comp_name} (mask={mask_id}, {mask_bbox["width"]}x{mask_bbox["height"]})')

        # Collect shapes
        idx = 0
        for child in elem.iter():
            tag = strip_ns(child.tag)
            if tag == 'ellipse':
                filter_elem = find_filter_for_element(child, parent_map, root)
                svg_content = build_shape_svg(child, filter_elem, mask_bbox, scale)
                prefix = 'e'
                comp_dir = os.path.join(output_dir, comp_name)
                os.makedirs(comp_dir, exist_ok=True)
                out_path = os.path.join(comp_dir, f'{comp_name}_{prefix}{idx}.png')
                render_jobs.append((svg_content, out_path, comp_name, f'{prefix}{idx}'))
                idx += 1
            elif tag == 'path':
                path_parent = parent_map.get(child)
                if path_parent is not None and path_parent.get('filter'):
                    filter_elem = find_filter_for_element(child, parent_map, root)
                    svg_content = build_shape_svg(child, filter_elem, mask_bbox, scale)
                    prefix = 'p'
                    comp_dir = os.path.join(output_dir, comp_name)
                    os.makedirs(comp_dir, exist_ok=True)
                    out_path = os.path.join(comp_dir, f'{comp_name}_{prefix}{idx}.png')
                    render_jobs.append((svg_content, out_path, comp_name, f'{prefix}{idx}'))
                    idx += 1

        # Mask
        blur = MASK_BLUR.get(comp_name, 3)
        mask_svg = build_mask_svg(mask_elem, mask_bbox, scale, blur_std=blur)
        comp_dir = os.path.join(output_dir, comp_name)
        os.makedirs(comp_dir, exist_ok=True)
        mask_out = os.path.join(comp_dir, f'{comp_name}_mask.png')
        render_jobs.append((mask_svg, mask_out, comp_name, 'mask', True))

    # Header (unmasked)
    for elem in root.iter():
        if elem.get('id') == 'Vector' and elem.get('filter'):
            print(f'Component: header (no mask)')
            filter_ref = elem.get('filter')
            filter_elem = None
            if filter_ref:
                fid_match = re.search(r'url\(#([^)]+)\)', filter_ref)
                if fid_match:
                    for m in root.iter():
                        if strip_ns(m.tag) == 'filter' and m.get('id') == fid_match.group(1):
                            filter_elem = m
                            break

            header_bbox = {'x': -50, 'y': -120, 'width': 490, 'height': 370}

            idx = 0
            for child in elem:
                if strip_ns(child.tag) == 'path':
                    svg_content = build_shape_svg(child, filter_elem, header_bbox, scale)
                    comp_dir = os.path.join(output_dir, 'header')
                    os.makedirs(comp_dir, exist_ok=True)
                    out_path = os.path.join(comp_dir, f'header_p{idx}.png')
                    render_jobs.append((svg_content, out_path, 'header', f'p{idx}'))
                    idx += 1

    # Render all with Playwright
    print(f'\nRendering {len(render_jobs)} PNGs at {scale}x...')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 2000, 'height': 2000})

        for job in render_jobs:
            if len(job) == 5:
                svg_content, out_path, comp, label, is_mask = job
            else:
                svg_content, out_path, comp, label = job
                is_mask = False
            render_svg_to_png(page, svg_content, out_path, is_mask=is_mask)
            size = os.path.getsize(out_path)
            print(f'  {out_path} ({size // 1024}KB)')

        browser.close()

    print('\nDone!')


if __name__ == '__main__':
    svg_path = sys.argv[1] if len(sys.argv) > 1 else 'Home_fixed_v3.svg'

    output_dir = OUTPUT_DIR
    scale = SCALE

    if '--output-dir' in sys.argv:
        i = sys.argv.index('--output-dir')
        if i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]

    if '--scale' in sys.argv:
        i = sys.argv.index('--scale')
        if i + 1 < len(sys.argv):
            scale = int(sys.argv[i + 1])

    process_svg(svg_path, output_dir, scale)
