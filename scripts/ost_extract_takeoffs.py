#!/usr/bin/env python3
"""
Extract OST BidTakeoff rows for a single BidPage into the CSV format
OstTakeoffImporter expects.

Usage:
    python3 scripts/ost_extract_takeoffs.py <ost_xml> <page_uid> <out_csv>

Output columns: BidConditionUID, GUID, UID, ConditionName, CondUOM, AreaName,
                Position, Curve, Kind, LayerName, ConditionType
Plus a manifest line printed to stdout with the page's PDF size for the
importer (PageWidth/PageHeight in pts).
"""
from __future__ import annotations

import csv
import sys
import xml.etree.ElementTree as ET


def main(ost: str, page_uid: str, out: str) -> int:
    tree = ET.parse(ost)
    root = tree.getroot()

    cond_info = {}
    for c in root.iter("BidCondition"):
        cond_info[c.get("UID")] = {
            "name": (c.get("Name") or "").strip(),
            "uom1": c.get("UOM1", "0"),
            "type": c.get("Type", "1"),  # 1=linear, 2=area
            "cdn_type_uid": c.get("CdnTypeUID", "0"),
            "layer_uid": c.get("BidLayerUID", "0"),
        }

    area_name = {a.get("UID"): (a.get("Name") or "").strip() for a in root.iter("BidArea")}
    layer_name = {l.get("UID"): (l.get("Name") or "").strip() for l in root.iter("BidLayer")}
    cdn_name = {c.get("UID"): (c.get("Name") or "").strip() for c in root.iter("CdnType")}

    page_w = page_h = None
    for p in root.iter("BidPage"):
        if p.get("UID") == page_uid:
            page_w = float(p.get("Width", "0"))
            page_h = float(p.get("Height", "0"))
            break
    if page_w is None:
        print(f"Page UID={page_uid} not found", file=sys.stderr)
        return 1

    UOM_MAP = {"0": "SM", "1": "LM", "2": "EA"}

    rows_written = 0
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["BidConditionUID", "GUID", "UID", "ConditionName",
                    "CondUOM", "AreaName", "Position", "Curve", "Kind",
                    "LayerName", "ConditionType"])
        for t in root.iter("BidTakeoff"):
            if t.get("BidPageUID") != page_uid:
                continue
            cu = t.get("BidConditionUID")
            ci = cond_info.get(cu, {})
            uom = UOM_MAP.get(ci.get("uom1", "0"), "SM")
            kind = "Area" if ci.get("type") == "2" else "Linear"
            w.writerow([
                cu,
                (t.get("GUID") or "").strip(" {}").lower(),
                t.get("UID", ""),
                ci.get("name", ""),
                uom,
                area_name.get(t.get("BidAreaUID"), ""),
                t.get("Position", ""),
                t.get("Curve", "-1"),
                kind,
                layer_name.get(ci.get("layer_uid"), ""),
                cdn_name.get(ci.get("cdn_type_uid"), ""),
            ])
            rows_written += 1

    # PDF dimensions: OST stores Width/Height in inches; importer needs pts.
    # 1 inch = 72 PDF pts.
    pdf_w_pt = page_w * 72.0
    pdf_h_pt = page_h * 72.0
    print(f"[ost_takeoffs] page_uid={page_uid} rows={rows_written}")
    print(f"[ost_takeoffs] page_size_in=({page_w:.4f}, {page_h:.4f})")
    print(f"[ost_takeoffs] pdf_pt=({pdf_w_pt:.4f}, {pdf_h_pt:.4f})")
    print(f"[ost_takeoffs] csv={out}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
