"""Pass/fail reporting: console summary, JSON (for CI), and a standalone HTML report.

The HTML report deliberately ships with **no external font/CDN links** — it embeds
its one failure screenshot as a base64 data URI and uses only system font stacks.
This is a QA artifact for a hackathon venue that "plans for offline, doesn't rely
on internet connectivity" (docs/00_PLAYBOOK.md §6) — it has to open correctly from
a laptop with no wifi at 3am during the overnight shift.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
DIM = "\033[2m"


@dataclass
class VerificationDetail:
    label: str
    passed: bool
    detail: str = ""


@dataclass
class ScreenResult:
    key: str
    title: str
    route: str
    data_used: dict[str, Any]
    status: str  # "pass" | "fail" | "error"
    duration_s: float
    verifications: list[VerificationDetail] = field(default_factory=list)
    error: str | None = None
    screenshot_b64: str | None = None
    created_id: str | None = None
    notes: str | None = None

    @property
    def ok(self) -> bool:
        return self.status == "pass"


@dataclass
class Report:
    started_at: datetime
    config: dict[str, Any]
    finished_at: datetime | None = None
    results: list[ScreenResult] = field(default_factory=list)

    def add(self, result: ScreenResult) -> None:
        self.results.append(result)

    @property
    def passed(self) -> list[ScreenResult]:
        return [r for r in self.results if r.status == "pass"]

    @property
    def failed(self) -> list[ScreenResult]:
        return [r for r in self.results if r.status != "pass"]

    @property
    def all_passed(self) -> bool:
        return len(self.results) > 0 and len(self.failed) == 0

    # ---- console --------------------------------------------------------

    def print_summary(self) -> None:
        total = len(self.results)
        print()
        print(f"{BOLD}Account module — Add-flow smoke suite{RESET}")
        print(f"{DIM}{self.config.get('base_url')}  ·  {self.started_at:%Y-%m-%d %H:%M:%S}{RESET}")
        print("-" * 64)
        for r in self.results:
            color = GREEN if r.status == "pass" else (YELLOW if r.status == "fail" else RED)
            badge = {"pass": "PASS", "fail": "FAIL", "error": "ERROR"}.get(r.status, r.status.upper())
            print(f"  {color}{BOLD}{badge:<6}{RESET} {r.title:<24} {DIM}{r.duration_s:5.2f}s{RESET}  {r.route}")
            for v in r.verifications:
                if v.passed:
                    continue
                print(f"         {RED}✗ {v.label} — {v.detail}{RESET}")
            if r.error:
                print(f"         {RED}✗ {r.error}{RESET}")
        print("-" * 64)
        color = GREEN if self.all_passed else RED
        print(f"{color}{BOLD}{len(self.passed)}/{total} screens passed{RESET}")
        print()

    # ---- json -------------------------------------------------------------

    def to_json(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "config": self.config,
            "summary": {
                "total": len(self.results),
                "passed": len(self.passed),
                "failed": len(self.failed),
                "all_passed": self.all_passed,
            },
            "results": [
                {**asdict(r), "verifications": [asdict(v) for v in r.verifications]}
                for r in self.results
            ],
        }
        path.write_text(json.dumps(payload, indent=2, default=str))
        return path

    # ---- html ---------------------------------------------------------------

    def to_html(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_render_html(self))
        return path


def _esc(value: Any) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _data_table(data: dict[str, Any]) -> str:
    rows = []
    for k, v in data.items():
        if isinstance(v, dict):
            v = ", ".join(f"{ik}={iv}" for ik, iv in v.items())
        rows.append(f"<tr><td class='k'>{_esc(k)}</td><td class='v mono'>{_esc(v)}</td></tr>")
    return "<table class='data'>" + "".join(rows) + "</table>"


def _verifications_html(verifications: list[VerificationDetail]) -> str:
    items = []
    for v in verifications:
        cls = "ok" if v.passed else "no"
        mark = "✓" if v.passed else "✗"
        detail = f" — {_esc(v.detail)}" if v.detail else ""
        items.append(f"<li class='{cls}'><span class='mark'>{mark}</span> {_esc(v.label)}{detail}</li>")
    return "<ul class='verifications'>" + "".join(items) + "</ul>"


def _screen_card(r: ScreenResult) -> str:
    status_class = {"pass": "pass", "fail": "fail", "error": "error"}.get(r.status, "fail")
    badge = {"pass": "PASS", "fail": "FAIL", "error": "ERROR"}.get(r.status, r.status.upper())
    screenshot = ""
    if r.screenshot_b64:
        screenshot = (
            "<div class='shot-wrap'><p class='shot-label'>Screenshot at failure</p>"
            f"<img class='shot' src='data:image/png;base64,{r.screenshot_b64}' alt='Failure screenshot for {_esc(r.title)}'/></div>"
        )
    error_html = f"<div class='error-box'>{_esc(r.error)}</div>" if r.error else ""
    notes_html = f"<p class='notes'>{_esc(r.notes)}</p>" if r.notes else ""
    created = f"<span class='mono created-id'>id: {_esc(r.created_id)}</span>" if r.created_id else ""
    return f"""
    <section class="card {status_class}">
      <div class="card-head">
        <div>
          <span class="badge {status_class}">{badge}</span>
          <h3>{_esc(r.title)}</h3>
          <p class="route mono">{_esc(r.route)}</p>
        </div>
        <div class="meta">
          <span class="dur mono">{r.duration_s:.2f}s</span>
          {created}
        </div>
      </div>
      {notes_html}
      <div class="grid">
        <div>
          <p class="section-label">Data submitted (real-world sample)</p>
          {_data_table(r.data_used)}
        </div>
        <div>
          <p class="section-label">Verification — UI &amp; API</p>
          {_verifications_html(r.verifications)}
        </div>
      </div>
      {error_html}
      {screenshot}
    </section>
    """


def _render_html(report: Report) -> str:
    total = len(report.results)
    passed = len(report.passed)
    failed = len(report.failed)
    overall = "PASS" if report.all_passed else "FAIL"
    overall_class = "pass" if report.all_passed else "fail"
    cards = "".join(_screen_card(r) for r in report.results)
    duration = (
        (report.finished_at - report.started_at).total_seconds()
        if report.finished_at
        else 0.0
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Account Module — Add-flow report</title>
<style>
  :root{{
    --paper:#ECE7DA; --paper-raised:#F5F1E6; --ink:#211F17; --ink-soft:#3A362A;
    --brass:#A8672E; --brass-ink:#7C4A1F; --green:#2F5D4C; --line:#CFC6AE;
    --line-strong:#B8AD8F; --muted:#6E6858; --danger:#8C3B2E;
  }}
  *{{box-sizing:border-box;}}
  body{{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:Georgia,"Times New Roman",serif;
  }}
  .body-sans{{ font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }}
  .mono{{ font-family:SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace; font-variant-numeric:tabular-nums; }}
  main{{ max-width:980px; margin:0 auto; padding:40px 28px 90px; font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }}
  h1,h2,h3{{ font-family:Georgia,"Times New Roman",serif; margin:0; }}
  .hero{{ max-width:680px; }}
  .eyebrow{{ font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--brass-ink); }}
  .hero h1{{ font-size:30px; margin-top:8px; }}
  .hero p{{ color:var(--ink-soft); margin-top:8px; font-size:14px; }}

  .summary{{ margin-top:24px; display:flex; gap:14px; align-items:stretch; flex-wrap:wrap; }}
  .summary .tile{{ background:var(--paper-raised); border:1px solid var(--line); border-radius:8px; padding:14px 20px; min-width:120px; }}
  .summary .tile.overall{{ border-color:var(--line-strong); border-left:4px solid var(--green); }}
  .summary .tile.overall.fail{{ border-left-color:var(--danger); }}
  .summary .k{{ font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }}
  .summary .v{{ font-size:22px; font-weight:700; margin-top:4px; }}

  .card{{ margin-top:22px; background:var(--paper-raised); border:1px solid var(--line); border-left:4px solid var(--line-strong); border-radius:8px; padding:18px 22px; }}
  .card.pass{{ border-left-color:var(--green); }}
  .card.fail, .card.error{{ border-left-color:var(--danger); }}
  .card-head{{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }}
  .card-head h3{{ font-size:18px; margin-top:4px; }}
  .route{{ color:var(--muted); font-size:12px; margin-top:2px; }}
  .badge{{ display:inline-block; font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; letter-spacing:.06em; padding:2px 8px; border-radius:99px; border:1px solid currentColor; }}
  .badge.pass{{ color:var(--green); }}
  .badge.fail, .badge.error{{ color:var(--danger); }}
  .meta{{ text-align:right; font-size:12px; color:var(--muted); white-space:nowrap; }}
  .meta .created-id{{ display:block; margin-top:4px; }}
  .notes{{ margin-top:10px; font-size:13px; color:var(--ink-soft); font-style:italic; }}

  .grid{{ margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }}
  .section-label{{ font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; }}
  table.data{{ width:100%; border-collapse:collapse; font-size:12.5px; }}
  table.data td{{ padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; }}
  table.data td.k{{ color:var(--muted); width:38%; }}
  ul.verifications{{ list-style:none; margin:0; padding:0; font-size:13px; display:flex; flex-direction:column; gap:6px; }}
  ul.verifications li{{ display:flex; gap:8px; align-items:baseline; }}
  ul.verifications li .mark{{ font-family:SFMono-Regular,Menlo,Consolas,monospace; flex:none; width:14px; }}
  ul.verifications li.ok .mark{{ color:var(--green); }}
  ul.verifications li.no .mark{{ color:var(--danger); font-weight:700; }}
  ul.verifications li.no{{ color:var(--danger); }}

  .error-box{{ margin-top:14px; background:#00000010; border:1px solid var(--danger); border-radius:6px; padding:10px 14px; font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; color:var(--danger); white-space:pre-wrap; word-break:break-word; }}
  .shot-wrap{{ margin-top:14px; }}
  .shot-label{{ font-family:SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; }}
  img.shot{{ max-width:100%; border:1px solid var(--line-strong); border-radius:6px; display:block; }}

  footer{{ margin-top:40px; padding-top:16px; border-top:1px solid var(--line); font-size:12px; color:var(--muted); }}

  @media (max-width: 720px){{ .grid{{ grid-template-columns:1fr; }} }}
</style>
</head>
<body>
<main>
  <div class="hero">
    <span class="eyebrow">Account Module · Add-flow smoke suite · Playwright</span>
    <h1>7 screens, 7 real records, 2 layers of proof</h1>
    <p>Each screen below was driven through the actual browser UI with realistic
       business data, then checked twice: once on screen, once against the live
       API for the id the UI redirected to. Run at {report.started_at:%Y-%m-%d %H:%M:%S}
       against <span class="mono">{_esc(report.config.get('base_url'))}</span>.</p>
  </div>

  <div class="summary">
    <div class="tile overall {overall_class}">
      <div class="k">Overall</div>
      <div class="v">{overall}</div>
    </div>
    <div class="tile"><div class="k">Screens</div><div class="v">{total}</div></div>
    <div class="tile"><div class="k">Passed</div><div class="v">{passed}</div></div>
    <div class="tile"><div class="k">Failed</div><div class="v">{failed}</div></div>
    <div class="tile"><div class="k">Duration</div><div class="v">{duration:.1f}s</div></div>
  </div>

  {cards}

  <footer>
    Generated by <span class="mono">qa/run_account_module_tests.py</span> —
    every "Data submitted" value traces to <span class="mono">qa/e2e/data.py</span>,
    not invented at report time. No external network resources are loaded by this
    file; it is safe to open offline.
  </footer>
</main>
</body>
</html>"""
