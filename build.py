"""Combine notes/*.json into data.js for the site.  Run: python3 build.py"""
import json, pathlib

ROOT = pathlib.Path(__file__).parent
VIDEOS = [  # order shown on the site
    dict(id="n7a9noclkFU", group="ATTD 2026", title="ATTD 2026: Biggest Diabetes Tech News Roundup", channel="Diabetech", duration="37:37", date="2026-03-23"),
    dict(id="d45wIend4N8", group="ATTD 2026", title="Diabetes Dialogue: ATTD 2026 Recap", channel="HCPLive", duration="32:55", date="2026-03-18"),
    dict(id="701rLCrNnAo", group="ATTD 2026", title="The Latest in Diabetes Tech. An ATTD 2026 Recap with Gary Scheiner", channel="Integrated Diabetes Services", duration="31:27", date=""),
    dict(id="dL6XS-pQhao", group="ADA 2026", title="ADA 2026 updates on Standard of care in Diabetes | Key Takeaways by Dr Sudhir", channel="ARASU-MEDPEDS", duration="20:10", date="2025-12-18"),
    dict(id="u0b7meuRyDM", group="ADA 2026", title="Diabetes Mellitus | Diagnosis & Classification | ADA 2026", channel="Medi - Lectures", duration="19:22", date="2026-08-24"),
]

out = []
for v in VIDEOS:
    p = ROOT / "notes" / f"{v['id']}.json"
    if not p.exists():
        print("missing", p.name); continue
    n = json.loads(p.read_text(encoding="utf-8"))
    n["sections"].sort(key=lambda s: s["t"])
    out.append({**v, **n, "id": v["id"]})
    print(v["id"], len(n["sections"]), "sections")

(ROOT / "data.js").write_text("window.VIDEOS=" + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote data.js with", len(out), "videos")
