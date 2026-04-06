#!/usr/bin/env python3
"""
Extract relative ellipse/path positions from a Figma SVG with mask groups.
Outputs JSON with positions relative to each mask's bounding box.

Usage: python extract_positions.py <input.svg> [--json output.json]

Works with both <ellipse> and <path> elements inside masked aurora groups.
Only uses Python stdlib (xml.etree, math, json, re) — no numpy/lxml needed.
"""

import xml.etree.ElementTree as ET
import math
import json
import re
import sys
import os

NS = {'svg': 'http://www.w3.org/2000/svg'}

# ── Matrix math (2D affine, 3x3) ──

def identity():
    return [1, 0, 0, 1, 0, 0]  # a, b, c, d, e, f

def mat_multiply(m1, m2):
    """Multiply two 2D affine matrices: m1 × m2.
    Matrix layout: [a, b, c, d, e, f] represents:
    | a c e |
    | b d f |
    | 0 0 1 |
    """
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [
        a1*a2 + c1*b2,       # a
        b1*a2 + d1*b2,       # b
        a1*c2 + c1*d2,       # c
        b1*c2 + d1*d2,       # d
        a1*e2 + c1*f2 + e1,  # e
        b1*e2 + d1*f2 + f1,  # f
    ]

def apply_matrix(m, x, y):
    """Apply affine matrix to a point."""
    a, b, c, d, e, f = m
    return (a*x + c*y + e, b*x + d*y + f)

def parse_transform(transform_str):
    """Parse an SVG transform attribute into a list of affine matrices."""
    if not transform_str:
        return identity()

    result = identity()
    # Find all transform functions
    for match in re.finditer(r'(\w+)\s*\(([^)]+)\)', transform_str):
        func = match.group(1)
        # Use findall to correctly handle negative numbers without preceding whitespace
        # e.g. "0.994726-0.102564" should parse as [0.994726, -0.102564]
        vals = [float(v) for v in re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', match.group(2))]

        if func == 'matrix':
            # SVG matrix(a,b,c,d,e,f)
            m = vals[:6]
        elif func == 'translate':
            tx = vals[0]
            ty = vals[1] if len(vals) > 1 else 0
            m = [1, 0, 0, 1, tx, ty]
        elif func == 'scale':
            sx = vals[0]
            sy = vals[1] if len(vals) > 1 else sx
            m = [sx, 0, 0, sy, 0, 0]
        elif func == 'rotate':
            angle = math.radians(vals[0])
            cos_a, sin_a = math.cos(angle), math.sin(angle)
            if len(vals) == 3:
                cx, cy = vals[1], vals[2]
                m = [cos_a, sin_a, -sin_a, cos_a,
                     cx - cos_a*cx + sin_a*cy,
                     cy - sin_a*cx - cos_a*cy]
            else:
                m = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
        elif func == 'skewX':
            m = [1, 0, math.tan(math.radians(vals[0])), 1, 0, 0]
        elif func == 'skewY':
            m = [1, math.tan(math.radians(vals[0])), 0, 1, 0, 0]
        else:
            continue

        result = mat_multiply(result, m)

    return result

def decompose_matrix(m):
    """Decompose 2D affine matrix into scaleX, scaleY, rotation (degrees), skew.
    Uses QR-like decomposition of the 2x2 part."""
    a, b, c, d, _, _ = m

    # Compute scale and rotation from the 2x2 part
    # Column vectors
    sx = math.sqrt(a*a + b*b)
    sy = math.sqrt(c*c + d*d)

    # Check for reflection (negative determinant)
    det = a*d - b*c
    if det < 0:
        sx = -sx

    # Rotation angle from first column
    rotation = math.degrees(math.atan2(b, a))

    return {
        'scaleX': sx,
        'scaleY': sy,
        'rotation': round(rotation, 2),
        'determinant': det,
    }

def get_path_bbox(d_attr):
    """Estimate bounding box from a path d attribute by extracting all coordinates."""
    if not d_attr:
        return None
    # Extract all numbers from the path data
    nums = re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d_attr)
    if len(nums) < 2:
        return None
    coords = [float(n) for n in nums]
    # Pair as x,y coordinates (best effort for absolute commands)
    xs = coords[0::2]
    ys = coords[1::2]
    if not xs or not ys:
        return None
    return {
        'x': min(xs),
        'y': min(ys),
        'width': max(xs) - min(xs),
        'height': max(ys) - min(ys),
    }

def strip_ns(tag):
    """Remove namespace from tag."""
    return tag.split('}')[-1] if '}' in tag else tag

def find_mask_shape_bbox(root, mask_id):
    """Find the bounding box of the shape inside a <mask> element."""
    for mask in root.iter():
        if strip_ns(mask.tag) == 'mask' and mask.get('id') == mask_id:
            # First try: mask element attributes
            mx = mask.get('x')
            my = mask.get('y')
            mw = mask.get('width')
            mh = mask.get('height')

            # Also find the shape inside the mask for the actual shape bbox
            shape_bbox = None
            for child in mask:
                tag = strip_ns(child.tag)
                if tag == 'rect':
                    shape_bbox = {
                        'x': float(child.get('x', 0)),
                        'y': float(child.get('y', 0)),
                        'width': float(child.get('width', 0)),
                        'height': float(child.get('height', 0)),
                    }
                elif tag == 'circle':
                    ccx = float(child.get('cx', 0))
                    ccy = float(child.get('cy', 0))
                    r = float(child.get('r', 0))
                    shape_bbox = {'x': ccx-r, 'y': ccy-r, 'width': 2*r, 'height': 2*r}
                elif tag == 'ellipse':
                    ecx = float(child.get('cx', 0))
                    ecy = float(child.get('cy', 0))
                    erx = float(child.get('rx', 0))
                    ery = float(child.get('ry', 0))
                    shape_bbox = {'x': ecx-erx, 'y': ecy-ery, 'width': 2*erx, 'height': 2*ery}
                elif tag == 'path':
                    shape_bbox = get_path_bbox(child.get('d', ''))

            # Prefer mask element attributes if available
            if mx is not None and my is not None:
                mask_bbox = {
                    'x': float(mx), 'y': float(my),
                    'width': float(mw) if mw else 0,
                    'height': float(mh) if mh else 0,
                }
            elif shape_bbox:
                mask_bbox = shape_bbox
            else:
                mask_bbox = {'x': 0, 'y': 0, 'width': 0, 'height': 0}

            return {
                'mask_element': mask_bbox,
                'shape': shape_bbox,
            }
    return None

def collect_transforms_to_root(element, parent_map):
    """Collect all transform matrices from element up to the masked group root."""
    transforms = []
    current = element
    while current is not None:
        t = current.get('transform')
        if t:
            transforms.append(parse_transform(t))
        # Stop if we hit the mask group
        if current.get('mask'):
            break
        current = parent_map.get(current)
    # Reverse: multiply from outermost to innermost
    transforms.reverse()
    result = identity()
    for t in transforms:
        result = mat_multiply(result, t)
    return result

def process_svg(svg_path):
    """Process an SVG file and extract ellipse/path positions relative to masks."""
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Build parent map
    parent_map = {}
    for parent in root.iter():
        for child in parent:
            parent_map[child] = parent

    # Find all masked groups
    components = {}

    for elem in root.iter():
        mask_ref = elem.get('mask')
        if not mask_ref:
            continue

        # Extract mask ID
        mask_match = re.match(r'url\(#([^)]+)\)', mask_ref)
        if not mask_match:
            continue
        mask_id = mask_match.group(1)

        # Find component name from parent group id
        parent = parent_map.get(elem)
        comp_name = None
        if parent is not None:
            comp_name = parent.get('id')
        if not comp_name:
            comp_name = elem.get('id') or mask_id

        # Get mask bbox
        mask_info = find_mask_shape_bbox(root, mask_id)
        if not mask_info:
            continue

        mask_bbox = mask_info['mask_element']
        shape_bbox = mask_info['shape']

        # Use shape bbox for relative positioning if available, otherwise mask element bbox
        ref_bbox = shape_bbox or mask_bbox

        # Find all ellipses and paths inside this masked group
        ellipses = []
        shape_index = 0

        for child_group in elem.iter():
            tag = strip_ns(child_group.tag)

            if tag == 'ellipse':
                shape_index += 1
                cx = float(child_group.get('cx', 0))
                cy = float(child_group.get('cy', 0))
                rx = float(child_group.get('rx', 0))
                ry = float(child_group.get('ry', 0))
                fill = child_group.get('fill', '')

                # Compute full transform chain
                combined = collect_transforms_to_root(child_group, parent_map)

                # Apply transform to center
                abs_cx, abs_cy = apply_matrix(combined, cx, cy)

                # Decompose matrix for scale/rotation
                decomp = decompose_matrix(combined)

                # Effective radii after transform
                eff_rx = rx * decomp['scaleX']
                eff_ry = ry * decomp['scaleY']

                # Relative to mask bbox
                rel_cx = abs_cx - ref_bbox['x']
                rel_cy = abs_cy - ref_bbox['y']

                ellipses.append({
                    'index': shape_index,
                    'type': 'ellipse',
                    'id': child_group.get('id', f'ellipse_{shape_index}'),
                    'fill': fill,
                    'original': {'cx': cx, 'cy': cy, 'rx': rx, 'ry': ry},
                    'transform': child_group.get('transform', ''),
                    'centerX': round(rel_cx, 2),
                    'centerY': round(rel_cy, 2),
                    'radiusX': round(abs(eff_rx), 2),
                    'radiusY': round(abs(eff_ry), 2),
                    'rotation': decomp['rotation'],
                    'relativeCenter': {
                        'xPercent': round(rel_cx / ref_bbox['width'], 4) if ref_bbox['width'] else 0,
                        'yPercent': round(rel_cy / ref_bbox['height'], 4) if ref_bbox['height'] else 0,
                    }
                })

            elif tag == 'path':
                # Skip mask-internal paths, only process aurora paths
                # (paths inside <g filter="...">)
                path_parent = parent_map.get(child_group)
                if path_parent is not None and path_parent.get('filter'):
                    shape_index += 1
                    d = child_group.get('d', '')
                    fill = child_group.get('fill', '')
                    path_bbox = get_path_bbox(d)

                    if path_bbox:
                        # Path center relative to mask
                        path_cx = path_bbox['x'] + path_bbox['width'] / 2
                        path_cy = path_bbox['y'] + path_bbox['height'] / 2
                        rel_cx = path_cx - ref_bbox['x']
                        rel_cy = path_cy - ref_bbox['y']

                        ellipses.append({
                            'index': shape_index,
                            'type': 'path',
                            'id': child_group.get('id', f'path_{shape_index}'),
                            'fill': fill,
                            'centerX': round(rel_cx, 2),
                            'centerY': round(rel_cy, 2),
                            'radiusX': round(path_bbox['width'] / 2, 2),
                            'radiusY': round(path_bbox['height'] / 2, 2),
                            'rotation': 0,
                            'bbox': path_bbox,
                            'relativeCenter': {
                                'xPercent': round(rel_cx / ref_bbox['width'], 4) if ref_bbox['width'] else 0,
                                'yPercent': round(rel_cy / ref_bbox['height'], 4) if ref_bbox['height'] else 0,
                            }
                        })

        if ellipses:
            components[comp_name] = {
                'maskId': mask_id,
                'mask': {
                    'x': round(mask_bbox['x'], 2),
                    'y': round(mask_bbox['y'], 2),
                    'width': round(mask_bbox['width'], 2),
                    'height': round(mask_bbox['height'], 2),
                },
                'shape': {
                    'x': round(ref_bbox['x'], 2),
                    'y': round(ref_bbox['y'], 2),
                    'width': round(ref_bbox['width'], 2),
                    'height': round(ref_bbox['height'], 2),
                } if shape_bbox else None,
                'viewBox': {
                    'width': round(ref_bbox['width'], 2),
                    'height': round(ref_bbox['height'], 2),
                },
                'ellipses': ellipses,
            }

    # Also find unmasked aurora groups (header)
    for elem in root.iter():
        elem_id = elem.get('id', '')
        if elem_id == 'Vector' and elem.get('filter'):
            paths = []
            idx = 0
            for child in elem:
                if strip_ns(child.tag) == 'path':
                    idx += 1
                    d = child.get('d', '')
                    fill = child.get('fill', '')
                    bbox = get_path_bbox(d)
                    if bbox:
                        paths.append({
                            'index': idx,
                            'type': 'path',
                            'id': child.get('id', f'header_path_{idx}'),
                            'fill': fill,
                            'centerX': round(bbox['x'] + bbox['width']/2, 2),
                            'centerY': round(bbox['y'] + bbox['height']/2, 2),
                            'radiusX': round(bbox['width']/2, 2),
                            'radiusY': round(bbox['height']/2, 2),
                            'rotation': 0,
                            'bbox': bbox,
                        })
            if paths:
                components['header'] = {
                    'maskId': None,
                    'mask': None,
                    'viewBox': {'width': 390, 'height': 250},
                    'ellipses': paths,
                }

    return {'components': components}


def print_summary(data):
    """Print human-readable summary."""
    for name, comp in data['components'].items():
        mask_str = f"mask={comp['maskId']}" if comp['maskId'] else "no mask"
        print(f"\nComponent: {name} ({mask_str})")
        if comp['mask']:
            m = comp['mask']
            print(f"  Mask: ({m['x']},{m['y']}) -> {m['width']}×{m['height']}")
        vb = comp['viewBox']
        print(f"  ViewBox: {vb['width']}×{vb['height']}")
        for e in comp['ellipses']:
            rot_str = f" rot={e['rotation']}°" if e.get('rotation', 0) != 0 else ""
            print(f"  {e['type'].capitalize()} {e['index']}: "
                  f"center=({e['centerX']}, {e['centerY']}) "
                  f"radii=({e['radiusX']}, {e['radiusY']}){rot_str} "
                  f"fill={e.get('fill', '?')}")


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

    # Print summary
    print_summary(data)

    # Write JSON if requested
    if json_output:
        with open(json_output, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"\nJSON written to: {json_output}")
    else:
        print("\n--- JSON ---")
        print(json.dumps(data, indent=2))
