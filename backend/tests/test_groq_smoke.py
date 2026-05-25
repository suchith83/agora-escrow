"""
Smoke test — verify Groq judge LLM call works end-to-end.

Prereq: GROQ_API_KEY in backend/.env

Run:
    cd backend && source .venv/bin/activate
    python tests/test_groq_smoke.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from judge_agent import judge, MODEL_NAME


CASES = [
    ("good",      "Write 'hello world' in Python.",  "print('hello world')"),
    ("bad",       "Write a 100-word essay on USDC.", "no"),
    ("ambiguous", "Build a website.",                "I made a single index.html with the word 'website' in it."),
]


def main():
    print(f"Smoke-testing judge with model: {MODEL_NAME}")
    print("=" * 60)
    for name, req, deliv in CASES:
        print(f"\n[{name}] requirements: {req}")
        print(f"        deliverable:  {deliv}")
        try:
            r = judge(requirements_md=req, deliverable_text=deliv)
        except Exception as e:
            print(f"  ✗ FAILED: {type(e).__name__}: {e}")
            sys.exit(1)
        print(f"  ✓ verdict={r['verdict']}  confidence={r['confidence']:.2f}")
        print(f"    reasoning: {r['reasoning']}")
    print("\n" + "=" * 60)
    print("✓ All Groq calls succeeded.")


if __name__ == "__main__":
    main()
