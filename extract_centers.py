#!/usr/bin/env python3
"""
Extract shape center positions from a Figma SVG with mask groups.
Outputs JSON with center positions relative to each mask's bounding box.

Centers are intended for React Native placement:
  <Image style={{
    position: 'absolute',
    left: center.x,
    top: center.y,
    transform: [{ translateX: -w/2 }, { translateY: -h/2 }]
  }} />

Usage: python extract_centers.py <input.svg> [--json output.json]

Only uses Python stdlib -- no external dependencies.
"""

import xml.etree.ElementTree as ET
import math
import json
import re
import sys


def strip_ns(tag):
    """Remove XML namespace from tag."""
    return tag.split('}')[-1] if '}' in tag else tag


def parse_matrix(transform_str):
    """Parse SVG transform attribute into [a, b, c, d, e, f] matrix.
    SVG matrix(a,b,c,d,e,f) represents:
    | a c e |
    | b d f |
    | 0 0 1 |
    """
    if not transform_str:
        return None

    for match in re.finditer(r'matrix\s*\(([^)]+)\)', transform_str):
        vals = [float(v) for v in re.findall(
            r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', match.group(1)
        )]
        if len(vals) >= 6:
            return vals[:6]

    # Handle translate, scale, etc.
    for match in re.finditer(r'translate\s*\(([^)]+)\)', transform_str):
        vals = [float(v) for v in re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)', match.group(1))]
        tx = vals[0]
        ty = vals[1] if len(vals) > 1 else 0
        return [1, 0, 0, 1, tx, ty]

    return None


def apply_matrix(m, x, y):
    """Apply affine matrix [a,b,c,d,e,f] to point (x,y)."""
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def mat_multiply(m1, m2):
    """Multiply two affine matrices."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [
        a1*a2 + c1*b2,
        b1*a2 + d1*b2,
        a1*c2 + c1*d2,
        b1*c2 + d1*d2,
        a1*e2 + c1*f2 + e1,
        b1*e2 + d1*f2 + f1,
    ]


def get_path_bbox(d_attr):
    """Estimate bounding box from SVG path d attribute.
    Parses M/m, L/l, C/c, S/s, H/h, V/v, Z commands.
    For curves, uses control points as approximation (good enough for blurred shapes).
    """
    if not d_attr:
        return None

    xs, ys = [], []
    cx, cy = 0, 0  # current position

    # Tokenize: split into commands and numbers
    tokens = re.findall(r'[MmLlCcSsQqTtAaHhVvZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d_attr)

    i = 0
    cmd = 'M'

    def next_num():
        nonlocal i
        while i < len(tokens) and re.match(r'[A-Za-z]', tokens[i]):
            i += 1
        if i < len(tokens):
            val = float(tokens[i])
            i += 1
            return val
        return 0

    while i < len(tokens):
        if re.match(r'[A-Za-z]', tokens[i]):
            cmd = tokens[i]
            i += 1

        if cmd in ('M', 'L'):
            cx, cy = next_num(), next_num()
            xs.append(cx); ys.append(cy)
            if cmd == 'M':
                cmd = 'L'  # subsequent coords after M are implicit L
        elif cmd in ('m', 'l'):
            dx, dy = next_num(), next_num()
            cx += dx; cy += dy
            xs.append(cx); ys.append(cy)
            if cmd == 'm':
                cmd = 'l'
        elif cmd == 'H':
            cx = next_num()
            xs.append(cx); ys.append(cy)
        elif cmd == 'h':
            cx += next_num()
            xs.append(cx); ys.append(cy)
        elif cmd == 'V':
            cy = next_num()
            xs.append(cx); ys.append(cy)
        elif cmd == 'v':
            cy += next_num()
            xs.append(cx); ys.append(cy)
        elif cmd == 'C':
            for _ in range(3):
                px, py = next_num(), next_num()
                xs.append(px); ys.append(py)
            cx, cy = xs[-1], ys[-1]
        elif cmd == 'c':
            for j in range(3):
                dx, dy = next_num(), next_num()
                px, py = cx + dx, cy + dy
                xs.append(px); ys.append(py)
                if j == 2:
                    cx, cy = px, py
        elif cmd == 'S':
            for _ in range(2):
                px, py = next_num(), next_num()
                xs.append(px); ys.append(py)
            cx, cy = xs[-1], ys[-1]
        elif cmd == 's':
            for j in range(2):
                dx, dy = next_num(), next_num()
                px, py = cx + dx, cy + dy
                xs.append(px); ys.append(py)
                if j == 1:
                    cx, cy = px, py
        elif cmd in ('Z', 'z'):
            pass
        else:
            # Unknown command, try to skip a number
            try:
                next_num()
            except:
                i += 1

    if not xs or not ys:
        return None

    return {
        'min_x': min(xs), 'max_x': max(xs),
        'min_y': min(ys), 'max_y': max(ys),
        'width': max(xs) - min(xs),
        'height': max(ys) - min(ys),
    }


def collect_parent_transforms(element, parent_map, stop_at_mask=True):
    """Walk up from element, collecting transforms on parent <g> elements.
    Stops at the masked group (the <g mask="..."> element).
    Returns combined matrix or None if no transforms found.
    """
    matrices = []
    current = parent_map.get(element)  # start from parent, not element itself
    while current is not None:
        if stop_at_mask and current.get('mask'):
            break
        t = current.get('transform')
        if t:
            m = parse_matrix(t)
            if m:
                matrices.append(m)
        current = parent_map.get(current)

    if not matrices:
        return None

    # Multiply from outermost to innermost
    matrices.reverse()
    result = matrices[0]
    for m in matrices[1:]:
        result = mat_multiply(result, m)
    return result


def find_mask_origin(root, mask_id):
    """Find the mask element and return its origin (x, y) and size (width, height)."""
    for elem in root.iter():
        if strip_ns(elem.tag) == 'mask' and elem.get('id') == mask_id:
            return {
                'id': mask_id,
                'x': float(elem.get('x', 0)),
                'y': float(elem.get('y', 0)),
                'width': float(elem.get('width', 0)),
                'height': float(elem.get('height', 0)),
            }
    return None


def process_svg(svg_path):
    """Process SVG and extract center positions for all shapes in mask groups."""
    tree = ET.parse(svg_path)
    root = tree.getroot()
    parent_map = {c: p for p in root.iter() for c in p}

    components = {}

    # Process masked groups
    for elem in root.iter():
        mask_ref = elem.get('mask')
        if not mask_ref:
            continue
        mask_match = re.search(r'url\(#([^)]+)\)', mask_ref)
        if not mask_match:
            continue
        mask_id = mask_match.group(1)

        # Component name from parent
        parent = parent_map.get(elem)
        comp_name = (parent.get('id') if parent is not None else None) or mask_id

        # Mask origin
        mask = find_mask_origin(root, mask_id)
        if not mask:
            continue

        shapes = []
        idx = 0

        for child in elem.iter():
            tag = strip_ns(child.tag)

            if tag == 'ellipse':
                cx = float(child.get('cx', 0))
                cy = float(child.get('cy', 0))
                fill = child.get('fill', '')

                # Get transform on the ellipse itself
                elem_matrix = parse_matrix(child.get('transform'))

                # Check for parent <g> transforms (rare in Figma exports, but handle it)
                parent_matrix = collect_parent_transforms(child, parent_map)

                # Combine: parent * element
                if parent_matrix and elem_matrix:
                    combined = mat_multiply(parent_matrix, elem_matrix)
                elif elem_matrix:
                    combined = elem_matrix
                elif parent_matrix:
                    combined = parent_matrix
                else:
                    combined = None

                # Apply transform to get absolute center
                if combined:
                    abs_cx, abs_cy = apply_matrix(combined, cx, cy)
                else:
                    abs_cx, abs_cy = cx, cy

                # Relative to mask origin
                rel_cx = abs_cx - mask['x']
                rel_cy = abs_cy - mask['y']

                shapes.append({
                    'type': 'ellipse',
                    'index': idx,
                    'fill': fill,
                    'center': {'x': round(rel_cx, 2), 'y': round(rel_cy, 2)},
                })
                idx += 1

            elif tag == 'path':
                # Only process paths inside filter groups (aurora paths, not mask shapes)
                path_parent = parent_map.get(child)
                if path_parent is None or not path_parent.get('filter'):
                    continue

                fill = child.get('fill', '')
                d = child.get('d', '')
                bbox = get_path_bbox(d)
                if not bbox:
                    continue

                # Path center from bounding box (coordinates are already absolute)
                abs_cx = (bbox['min_x'] + bbox['max_x']) / 2
                abs_cy = (bbox['min_y'] + bbox['max_y']) / 2

                # Check for transforms (unlikely for paths in Figma exports)
                elem_matrix = parse_matrix(child.get('transform'))
                parent_matrix = collect_parent_transforms(child, parent_map)
                if parent_matrix and elem_matrix:
                    combined = mat_multiply(parent_matrix, elem_matrix)
                elif elem_matrix:
                    combined = elem_matrix
                elif parent_matrix:
                    combined = parent_matrix
                else:
                    combined = None

                if combined:
                    abs_cx, abs_cy = apply_matrix(combined, abs_cx, abs_cy)

                # Relative to mask origin
                rel_cx = abs_cx - mask['x']
                rel_cy = abs_cy - mask['y']

                shapes.append({
                    'type': 'path',
                    'index': idx,
                    'fill': fill,
                    'center': {'x': round(rel_cx, 2), 'y': round(rel_cy, 2)},
                    'bbox_size': {
                        'width': round(bbox['width'], 2),
                        'height': round(bbox['height'], 2),
                    },
                })
                idx += 1

        if shapes:
            components[comp_name] = {
                'mask': mask,
                'shapes': shapes,
            }

    # Unmasked header aurora
    for elem in root.iter():
        if elem.get('id') == 'Vector' and elem.get('filter'):
            shapes = []
            idx = 0
            for child in elem:
                if strip_ns(child.tag) == 'path':
                    fill = child.get('fill', '')
                    bbox = get_path_bbox(child.get('d', ''))
                    if bbox:
                        shapes.append({
                            'type': 'path',
                            'index': idx,
                            'fill': fill,
                            'center': {
                                'x': round((bbox['min_x'] + bbox['max_x']) / 2, 2),
                                'y': round((bbox['min_y'] + bbox['max_y']) / 2, 2),
                            },
                            'bbox_size': {
                                'width': round(bbox['width'], 2),
                                'height': round(bbox['height'], 2),
                            },
                        })
                        idx += 1
            if shapes:
                components['header'] = {
                    'mask': None,
                    'shapes': shapes,
                }

    return {'components': components}


def print_summary(data):
    """Print human-readable summary."""
    for name, comp in data['components'].items():
        mask = comp['mask']
        if mask:
            print(f"\nComponent: {name} (mask={mask['id']})")
            print(f"  Mask origin: ({mask['x']}, {mask['y']}), size: {mask['width']}x{mask['height']}")
        else:
            print(f"\nComponent: {name} (no mask)")
        for s in comp['shapes']:
            extra = ''
            if 'bbox_size' in s:
                extra = f" [bbox: {s['bbox_size']['width']}x{s['bbox_size']['height']}]"
            print(f"  Shape {s['index']} [{s['type']}, {s['fill']}]: "
                  f"center=({s['center']['x']}, {s['center']['y']}){extra}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <input.svg> [--json output.json]")
        sys.exit(1)

    svg_path = sys.argv[1]
    json_output = None
    if '--json' in sys.argv:
        idx = sys.argv.index('--json')
        if idx + 1 < len(sys.argv):
            json_output = sys.argv[idx + 1]

    data = process_svg(svg_path)
    print_summary(data)

    if json_output:
        with open(json_output, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"\nJSON written to: {json_output}")
    else:
        print("\n--- JSON ---")
        print(json.dumps(data, indent=2))
