#!/usr/bin/env python3
"""
Extract per-(condition, LCC) calibration data from an OST XML file:
  - hours: total BidLaborActivit.Hours for that pair (project-wide budget)
  - project_qty_m: project-wide takeoff qty in linear meters, recomputed from
    every BidTakeoff.Position belonging to the same BidCondition

Output JSON shape:
  {
    "cond_name|lcc_code": {"hours": <float>, "project_qty_m": <float>},
    ...
  }

The app uses these to set condition_labour_codes.production_rate so that:
  app_budget = sum(imported_qty) / rate
             = sum(imported_qty) * (hours / project_qty_m)
             = pro-rata share of OST hours for the imported takeoffs.

This avoids the trap of using sum(imported computed_value) as the denominator,
which under-counts when only a subset of OST pages were imported as drawings.
"""
from __future__ import annotations

import json
import math
import sys
import xml.etree.ElementTree as ET

# OstPositionParser converts OST_units → PDF pts × 0.72, then PDF pts → real
# meters ÷ 28.3464566929 (A1 1:100 metric sheet calibration).
# Net: 1 OST unit = 0.72 / 28.3464566929 ≈ 0.0254 m of real-world length.
OST_UNIT_TO_M = 0.72 / 28.3464566929


def parse_pairs(pos: str):
    if not pos:
        return []
    nums = pos.replace(";", " ").split()
    pts = []
    for i in range(0, len(nums) - 1, 2):
        try:
            pts.append((float(nums[i]), float(nums[i + 1])))
        except ValueError:
            return []
    return pts


def tokenize(raw: str):
    s = raw.strip()
    if s.startswith("b'"):
        s = s[2:]
    if s.endswith("'"):
        s = s[:-1]
    s = s.replace("\\n", "")
    return [t for t in s.split(";") if t != ""]


def extract_bulge(raw: str, curve_flag: int) -> float:
    if curve_flag != 0:
        return 0.0
    toks = tokenize(raw)
    return float(toks[6]) if len(toks) >= 7 else 0.0


def takeoff_length_m(pos: str, curve_flag: int) -> float:
    """Mirror OstPositionParser::buildPoints exactly:
       * curveFlag=0 + bulge != 0 → 3-point arc, return R × sweep.
       * else → straight 2-vertex segment (first 2 points only)."""
    pairs = parse_pairs(pos)
    if not pairs:
        return 0.0
    bulge = extract_bulge(pos, curve_flag)

    # Curved arc (mirrors PHP line 75+).
    if curve_flag == 0 and len(pairs) >= 3 and abs(bulge) > 1e-6:
        v1, v2, v3 = pairs[0], pairs[1], pairs[2]
        cmx = (v1[0] + v2[0]) / 2
        cmy = (v1[1] + v2[1]) / 2
        ch_dx = v2[0] - v1[0]
        ch_dy = v2[1] - v1[1]
        ch_len = math.hypot(ch_dx, ch_dy)
        if ch_len < 1e-6:
            return ch_len * OST_UNIT_TO_M
        perp_x = ch_dy / ch_len
        perp_y = -ch_dx / ch_len
        dot_v3 = (v3[0] - cmx) * perp_x + (v3[1] - cmy) * perp_y
        sgn = 1 if dot_v3 >= 0 else -1
        amx = cmx + sgn * bulge * perp_x
        amy = cmy + sgn * bulge * perp_y

        ax, ay = v1
        bx, by = amx, amy
        cx, cy = v2
        D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
        if abs(D) < 1e-9:
            return ch_len * OST_UNIT_TO_M
        ox = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D
        oy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D
        r0x = ax - ox
        r0y = ay - oy
        R = math.hypot(r0x, r0y)
        if R < 1e-6:
            return ch_len * OST_UNIT_TO_M

        t0 = math.atan2(r0y, r0x)
        tm = math.atan2(amy - oy, amx - ox)
        t2 = math.atan2(cy - oy, cx - ox)
        ccw_sweep = t2 - t0
        while ccw_sweep < 0:
            ccw_sweep += 2 * math.pi
        ccw_tm = tm - t0
        while ccw_tm < 0:
            ccw_tm += 2 * math.pi
        sweep = ccw_sweep if 0 < ccw_tm < ccw_sweep else (2 * math.pi - ccw_sweep)
        return R * sweep * OST_UNIT_TO_M

    # Straight: PHP only takes first 2 vertices (single segment).
    seg_pts = []
    for i, p in enumerate(pairs):
        if i >= 2 and abs(p[0]) < 1 and abs(p[1]) < 1:
            break
        if len(seg_pts) >= 2:
            break
        seg_pts.append(p)
    if len(seg_pts) < 2:
        return 0.0
    return math.hypot(seg_pts[1][0] - seg_pts[0][0], seg_pts[1][1] - seg_pts[0][1]) * OST_UNIT_TO_M


def main(ost_path: str, out_path: str) -> int:
    tree = ET.parse(ost_path)
    root = tree.getroot()

    cc_name = {c.get("UID"): c.get("Name", "").strip() for c in root.iter("CostCode")}
    blcc_to_cc_name: dict[str, str] = {}
    for b in root.iter("BidLaborCostCode"):
        cu = b.get("CostCodeUID")
        if cu in cc_name:
            blcc_to_cc_name[b.get("UID")] = cc_name[cu]

    cond_name = {c.get("UID"): c.get("Name", "").strip() for c in root.iter("BidCondition")}

    # Project-wide qty per BidCondition.UID. For length-bearing takeoffs we sum
    # linear meters (mirrors OstPositionParser). For count-type conditions (every
    # takeoff is a single-point marker) we sum the takeoff count instead — the
    # app stores computed_value=1 for each, so a "count-per-hour" rate makes
    # qty/rate = correct hours-per-count.
    #
    # NOTE: this calibration metric must mirror what the app divides by when it
    # computes budget hours. The app stores `computed_value` in linear meters
    # for non-count takeoffs and `computed_value=1` (or condition.height) for
    # single-point/count fallback. So summing linear-meter for takeoffs that
    # produced a length, plus count for those that produced a marker, matches
    # the app's denominator exactly.
    proj_qty_m: dict[str, float] = {}
    proj_count: dict[str, int] = {}
    for t in root.iter("BidTakeoff"):
        cu = t.get("BidConditionUID")
        if not cu:
            continue
        try:
            curve_flag = int(t.get("Curve", "-1"))
        except ValueError:
            curve_flag = -1
        L = takeoff_length_m(t.get("Position", ""), curve_flag)
        proj_count[cu] = proj_count.get(cu, 0) + 1
        if L > 0:
            proj_qty_m[cu] = proj_qty_m.get(cu, 0.0) + L

    # Aggregate hours per (BidCondition.UID, BidLaborCostCode.UID) — multiple
    # BidLaborActivit rows can target the same pair; sum.
    hours_by_pair: dict[tuple[str, str], float] = {}
    for la in root.iter("BidLaborActivit"):
        if la.get("IsActive") == "0":
            continue
        try:
            h = float(la.get("Hours", "0"))
        except ValueError:
            continue
        if h <= 0:
            continue
        cu = la.get("BidConditionUID")
        bu = la.get("BidLaborCostCodeUID")
        if not cu or not bu:
            continue
        hours_by_pair[(cu, bu)] = hours_by_pair.get((cu, bu), 0.0) + h

    out: dict[str, dict] = {}
    for (cu, bu), hrs in hours_by_pair.items():
        cname = cond_name.get(cu)
        lcode = blcc_to_cc_name.get(bu)
        if not cname or not lcode:
            continue
        key = f"{cname}|{lcode}"
        # Prefer linear-meter total; fall back to takeoff count when the cond
        # is count-type (every takeoff is a single point with no length).
        qty = proj_qty_m.get(cu, 0.0)
        if qty <= 0:
            qty = float(proj_count.get(cu, 0))
        prev = out.get(key)
        if prev:
            prev["hours"] += hrs
        else:
            out[key] = {"hours": hrs, "project_qty_m": qty}

    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"[ost_activity] wrote {len(out)} (cond, LCC) pairs to {out_path}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
