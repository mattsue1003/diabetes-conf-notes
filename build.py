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

# Full transcripts (from raw/ captions). Written to transcript.js, which is
# gitignored: it stays on this computer and is never pushed to the public site.
import html, re
# Auto-captions mishear drug/device names; fix the ones we know so search finds them.
CORRECTIONS = [
    (r"\bterzepatide\b", "tirzepatide"), (r"\btwin creatins?\b", "twincretin"),
    (r"\bFiosp\b", "Fiasp"), (r"\bLumgev\b", "Lyumjev"), (r"\bDiaboLoop\b", "Diabeloop"),
    (r"\bSteady Set\b", "SteadiSet"), (r"\bT-Slim\b", "t:slim"),
    (r"\bliverox bandan\b", "rivaroxaban"), (r"\bclidography\b", "clopidogrel"), (r"\bsatim\b", "ezetimibe"),
    (r"\b(?:finan|findrinan|pindan)\b", "finerenone"), (r"\beplesomeap\b", "teplizumab"),
    (r"\bSinclair sync\b", "Simplera Sync"), (r"\bSimpla\b", "Simplera"), (r"\bSQL MedTech\b", "Sequel MedTech"),
    (r"(?<!don't )\b[Tt]wist\b", "twiist"), (r"\bBoris Kabach\b", "Boris Kovatchev"),
    (r"\bEOPump\b", "YpsoPump"), (r"\bFintorio\b", "efsitora"),
]
tr = {}
for v in VIDEOS:
    rp = ROOT / "raw" / f"{v['id']}.json"
    if rp.exists():
        paras = json.loads(rp.read_text(encoding="utf-8"))
        clean = []
        for t, txt in paras:
            txt = html.unescape(txt)
            for pat, rep in CORRECTIONS:
                txt = re.sub(pat, rep, txt, flags=re.I if pat.islower() else 0)
            txt = re.sub(r"\s*>>\s*", " ¶ ", txt)          # speaker change marker
            txt = re.sub(r"\s+", " ", txt).strip(" ¶")
            clean.append([t, txt])
        zp = ROOT / "raw" / f"{v['id']}.zh.json"   # Traditional Chinese translation, same paragraphs
        if zp.exists():
            zh = json.loads(zp.read_text(encoding="utf-8"))
            assert len(zh) == len(clean) and all(z[1] == c[0] for z, c in zip(zh, clean)), f"{zp.name} does not line up"
            for c, z in zip(clean, zh):
                c.append(re.sub(r"\s*¶\s*", " ¶ ", z[2]).strip(" ¶"))
        tr[v["id"]] = clean
if tr:
    (ROOT / "transcript.js").write_text("window.TRANSCRIPTS=" + json.dumps(tr, ensure_ascii=False) + ";\n", encoding="utf-8")
    print("wrote transcript.js:", {k: len(x) for k, x in tr.items()})

(ROOT / "data.js").write_text("window.VIDEOS=" + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote data.js with", len(out), "videos")
