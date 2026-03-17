# Safety Dashboard — Requirements

**Status:** Planned | **Last Updated:** 2026-03-17

---

## Purpose

Answer one question: **"What is our safety performance across all projects?"**

Provides a centralised view of incident and injury data, aggregated into two reporting tables: a monthly project overview and a financial-year-to-date WHS performance summary. Data is imported from the master Incident/Injury Register Excel file.

---

## Data Import

Users upload the Incident/Injury Register Excel file (`.xlsx`) directly on the dashboard page. The system extracts each incident record including: date, employee, project, injury classification, body location, incident type, workcover claim status, days lost, and days on suitable duties.

Re-uploading the same file updates existing records without creating duplicates. After import, a summary shows how many records were imported and any errors encountered.

---

## Table 1: Monthly Project Overview

A table showing safety metrics aggregated by project for a selected month. Users pick the month/year from dropdowns (defaults to current month).

| Column | What it shows |
|---|---|
| Project | Project name |
| # of Reported Injuries | Total incidents reported that month |
| Type of Injury(s) | Breakdown of injuries, e.g. "2x Back Sprain/Strain, 1x Eye Foreign Body" |
| WCQ Claims | How many incidents had a workcover claim filed |
| Lost Time Injuries (LTI) | Count of LTI incidents |
| Total Days Lost | Sum of all days lost due to injuries |
| Medical Treatment Injuries (MTI) | Count of MTI incidents |
| Days on Suitable Duties | Sum of days employees were on modified duties |
| First Aid Injuries | Count of first aid only incidents |
| Near Miss | Count of near miss incidents |
| Medical Expenses (Non-work cover) | Total non-workcover medical costs ($) |

A **Grand Total** row at the bottom sums all projects.

---

## Table 2: WHS Performance — Current FY to Date

Same structure as Table 1, but covers the full current Australian financial year (1 July – 30 June) with two additional columns:

| Additional Column | What it shows |
|---|---|
| Report Only Injuries | Count of report-only incidents (no injury) |
| Number of Man Hours Worked | Total hours worked on each project, derived from clock-in/clock-out data |

The FY is automatically determined (e.g. "FY2025/2026") and displayed as a header. Grand total row included.

---

## Page Layout

1. **Import section** at the top — file upload button, last import timestamp, total records in the system
2. **Tabbed layout** with two tabs:
   - **Monthly Overview** (default) — month/year selectors + "Load Data" button + Table 1
   - **WHS Performance (FY to Date)** — auto-loads on tab switch + Table 2

---

## Security

| Permission | Grants |
|---|---|
| View Safety Dashboard | View both tables, upload Excel imports |

Available to **admin**, **backoffice**, and **manager** roles. Accessed via the **Reports** section in the sidebar.

---

## Assumptions

- Incident data is maintained in the Excel register and periodically uploaded (not entered in-app).
- "Near Miss" and "Medical Expenses" columns may show zero until future data includes them.
- Man hours are derived from existing clock data. Accuracy depends on clock data completeness.
- All amounts in AUD.

---

## Glossary

| Term | Definition |
|---|---|
| **LTI** | Lost Time Injury — time away from work due to injury |
| **MTI** | Medical Treatment Injury — requires medical treatment beyond first aid |
| **WCQ** | Workcover Claim — claim under workers' compensation insurance |
| **Near Miss** | Incident that could have caused injury but did not |
| **First Aid Only** | Injury treated with basic first aid only |
| **Report Only** | Incident recorded for documentation, no injury occurred |
| **FY** | Financial Year — Australian: 1 July to 30 June |
| **Man Hours** | Total hours worked, from clock-in/clock-out records |
