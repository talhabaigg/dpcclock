#!/usr/bin/env python3
"""
Extract OST BidPercent rows into a production CSV consumable by
OstProductionImporter (POST /drawings/{drawing}/import-ost-production).

Usage:
    python3 scripts/ost_extract_production.py \
        <path-to-OST-xml> <path-to-dpc_filters.json> <output.csv>

Output columns: GUID,LccCode,WorkDate,PercentComplete

The filters JSON (built via artisan tinker) tells the script which GUIDs and
LCC codes exist in the target location, plus which (condition, LCC) pairs are
valid — so we never emit a row the importer would reject.
"""
from __future__ import annotations

import csv
import json
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict


def parse_ost_date(raw: str):
    if not raw:
        return None
    parts = raw.strip().split()
    if len(parts) < 3:
        return None
    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    if y < 1900:
        return None
    return f"{y:04d}-{m:02d}-{d:02d}"


def main(ost_path: str, filters_path: str, out_path: str) -> int:
    with open(filters_path) as f:
        filt = json.load(f)
    guid_to_tc: dict[str, int] = {k.lower(): int(v) for k, v in filt["guid_to_tc"].items()}
    lcc_code_to_id: dict[str, int] = {k.upper(): int(v) for k, v in filt["lcc_code_to_id"].items()}
    allowed_tc_lcc: dict[int, set[int]] = {
        int(tc): {int(lcc) for lcc in lcc_map}
        for tc, lcc_map in filt["allowed_tc_lcc"].items()
    }

    print(f"[filters] guids={len(guid_to_tc)} lccs={len(lcc_code_to_id)} "
          f"conditions={len(allowed_tc_lcc)}")

    print(f"[parse] reading {ost_path} ...")
    tree = ET.parse(ost_path)
    root = tree.getroot()

    # OST CostCode.UID -> Name
    cc_uid_to_name: dict[int, str] = {}
    for cc in root.iter("CostCode"):
        uid = cc.get("UID")
        name = cc.get("Name")
        if uid and name:
            cc_uid_to_name[int(uid)] = name.strip()

    # BidLaborCostCode.UID -> CostCode.UID
    blcc_uid_to_cc_uid: dict[int, int] = {}
    for blcc in root.iter("BidLaborCostCode"):
        uid = blcc.get("UID")
        cc_uid = blcc.get("CostCodeUID")
        if uid and cc_uid:
            blcc_uid_to_cc_uid[int(uid)] = int(cc_uid)

    # BidTakeoff.UID -> (GUID, BidConditionUID). Cond is needed for BLCC weighting.
    takeoff_uid_to_guid: dict[int, str] = {}
    takeoff_uid_to_cond: dict[int, int] = {}
    for t in root.iter("BidTakeoff"):
        uid = t.get("UID")
        guid = t.get("GUID")
        cond = t.get("BidConditionUID")
        if uid and guid:
            takeoff_uid_to_guid[int(uid)] = guid.strip(" {}").lower()
            if cond:
                takeoff_uid_to_cond[int(uid)] = int(cond)

    # BidLaborActivit hours per (BidConditionUID, BidLaborCostCodeUID) — needed
    # to weight per-BLCC percents into a single LCC-level percent. OST splits
    # one cost code (e.g. 001_INT_FRAME) across multiple BLCCs (top track,
    # studs, etc.) and tracks each BLCC's progress independently. To match
    # OST's earned-hours rollup, we collapse them back via:
    #   weighted_pct = Σ(pct_BLCC × hours_BLCC) / Σ hours_BLCC
    # Then earned = budget × weighted_pct/100 = OST's per-BLCC sum exactly.
    activity_hours: dict[tuple[int, int], float] = {}
    for la in root.iter("BidLaborActivit"):
        if la.get("IsActive") == "0":
            continue
        try:
            cu = int(la.get("BidConditionUID", "0"))
            bu = int(la.get("BidLaborCostCodeUID", "0"))
            hrs = float(la.get("Hours", "0"))
        except ValueError:
            continue
        if cu and bu and hrs > 0:
            activity_hours[(cu, bu)] = activity_hours.get((cu, bu), 0.0) + hrs

    # BidTimeCardState.UID -> ISO date (skip invalid)
    tcs_uid_to_date: dict[int, str] = {}
    for tcs in root.iter("BidTimeCardState"):
        if tcs.get("IsValid") == "0":
            continue
        uid = tcs.get("UID")
        d = parse_ost_date(tcs.get("Date", ""))
        if uid and d:
            tcs_uid_to_date[int(uid)] = d

    print(f"[joins] cost_codes={len(cc_uid_to_name)} bidlcc={len(blcc_uid_to_cc_uid)} "
          f"takeoffs_w_guid={len(takeoff_uid_to_guid)} timecard_dates={len(tcs_uid_to_date)}")

    # First pass: collect raw per-BLCC percents per (guid, date, lcc, blcc).
    # We need per-BLCC granularity to weight by BidLaborActivit hours later.
    raw: dict[tuple[str, str, str, int], int] = {}

    counters = defaultdict(int)
    for bp in root.iter("BidPercent"):
        counters["seen"] += 1
        try:
            pct = int(round(float(bp.get("Percent", "0"))))
        except ValueError:
            counters["bad_percent"] += 1
            continue
        if pct <= 0 or pct > 100:
            counters["zero_or_oor"] += 1
            continue

        try:
            takeoff_uid = int(bp.get("BidTakeoffUID", "0"))
            blcc_uid = int(bp.get("BidLaborCostCodeUID", "0"))
            tcs_uid = int(bp.get("BidTimeCardStateUID", "0"))
        except ValueError:
            counters["bad_uid"] += 1
            continue

        if takeoff_uid == 0 or blcc_uid == 0 or tcs_uid == 0:
            counters["zero_fk"] += 1
            continue

        guid = takeoff_uid_to_guid.get(takeoff_uid)
        if guid is None:
            counters["takeoff_no_guid"] += 1
            continue

        tc = guid_to_tc.get(guid)
        if tc is None:
            counters["guid_not_in_db"] += 1
            continue

        cc_uid = blcc_uid_to_cc_uid.get(blcc_uid)
        if cc_uid is None:
            counters["blcc_no_cc"] += 1
            continue
        lcc_name = cc_uid_to_name.get(cc_uid, "").upper()
        if not lcc_name:
            counters["cc_no_name"] += 1
            continue

        lcc_id = lcc_code_to_id.get(lcc_name)
        if lcc_id is None:
            counters["lcc_not_in_db"] += 1
            continue

        if lcc_id not in allowed_tc_lcc.get(tc, set()):
            counters["lcc_not_on_condition"] += 1
            continue

        date = tcs_uid_to_date.get(tcs_uid)
        if date is None:
            counters["tcs_invalid"] += 1
            continue

        rkey = (guid, date, lcc_name, blcc_uid)
        prev = raw.get(rkey)
        # Multiple BidPercent rows for same (takeoff, BLCC, date) can occur if
        # per-BidLaborActivity rows duplicate the percent — keep the max.
        if prev is None or pct > prev:
            raw[rkey] = pct
        counters["kept"] += 1

    # Build cond → set of BLCC UIDs per LccCode. We need this so that BLCCs
    # with NO BidPercent rows for a takeoff still contribute 0% × hours to
    # the weighted average (otherwise we silently inflate the percent).
    cond_lcc_to_blccs: dict[tuple[int, str], set[int]] = defaultdict(set)
    for (cu, bu), _ in activity_hours.items():
        cc_uid = blcc_uid_to_cc_uid.get(bu)
        if cc_uid is None:
            continue
        lcc_name = cc_uid_to_name.get(cc_uid, "").upper()
        if lcc_name:
            cond_lcc_to_blccs[(cu, lcc_name)].add(bu)

    # Group raw percents by (guid, date, lcc) → {blcc: pct}
    by_glcd: dict[tuple[str, str, str], dict[int, int]] = defaultdict(dict)
    for (guid, date, lcc, blcc), pct in raw.items():
        by_glcd[(guid, date, lcc)][blcc] = pct

    # Build guid → cond_uid (OST)
    guid_to_cond_uid: dict[str, int] = {}
    for tu, g in takeoff_uid_to_guid.items():
        cu = takeoff_uid_to_cond.get(tu)
        if cu is not None:
            guid_to_cond_uid[g] = cu

    weighted_misses = 0
    out_rows: dict[tuple[str, str, str], int] = {}
    for (guid, date, lcc), pct_by_blcc in by_glcd.items():
        cu = guid_to_cond_uid.get(guid)
        if not cu:
            # No cond → fall back to max
            out_rows[(guid, date, lcc)] = max(pct_by_blcc.values())
            continue

        # Iterate ALL BLCCs that this cond has activity hours for under this
        # LCC. BLCCs missing from pct_by_blcc contribute 0% (implicit).
        all_blccs = cond_lcc_to_blccs.get((cu, lcc), set(pct_by_blcc.keys()))
        weighted_sum = 0.0
        total_h = 0.0
        for blcc in all_blccs:
            h = activity_hours.get((cu, blcc), 0.0)
            p = pct_by_blcc.get(blcc, 0)
            weighted_sum += p * h
            total_h += h
        if total_h > 0:
            wp = weighted_sum / total_h
        else:
            weighted_misses += 1
            wp = max(pct_by_blcc.values())
        out_rows[(guid, date, lcc)] = int(round(wp))

    counters["weighted_misses"] = weighted_misses
    print(f"[walk] {dict(counters)}")
    print(f"[output] writing {len(out_rows)} unique (guid,date,lcc) rows to {out_path}")

    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["GUID", "LccCode", "WorkDate", "PercentComplete"])
        for (guid, date, lcc), pct in sorted(out_rows.items()):
            w.writerow([guid, lcc, date, pct])

    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
