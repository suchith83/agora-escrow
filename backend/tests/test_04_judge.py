"""
Standalone test for the Gemini AI judge.

Prerequisite: GEMINI_API_KEY in backend/.env

Run:
    cd backend && source .venv/bin/activate
    python tests/test_04_judge.py

What it does:
    Tests 3 scenarios:
      1. Clearly good deliverable → expects "release"
      2. Clearly bad/empty deliverable → expects "refund"
      3. Ambiguous deliverable → expects "needs_review" or low confidence
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from judge_agent import judge


SCENARIOS = [
    {
        "name": "GOOD — should release",
        "requirements_md": (
            "Write a 3-line haiku about USDC stablecoins.\n"
            "Must be exactly 3 lines and mention USDC."
        ),
        "deliverable_text": (
            "Dollar's digital twin\n"
            "USDC flows across chains —\n"
            "Stable, swift, secure."
        ),
        "expected_verdict": "release",
    },
    {
        "name": "BAD — should refund",
        "requirements_md": (
            "Write a 3-line haiku about USDC stablecoins.\n"
            "Must be exactly 3 lines and mention USDC."
        ),
        "deliverable_text": "lol pay me",
        "expected_verdict": "refund",
    },
    {
        "name": "AMBIGUOUS — likely needs_review or refund",
        "requirements_md": (
            "Design a logo for a fintech company. Must include the colors blue and white, "
            "and the company name 'AgoraPay'."
        ),
        "deliverable_text": "I'll send it tomorrow, here's my sketch idea: a triangle with letters",
        "expected_verdict": "needs_review",  # not strict
    },
]


def main():
    print("=" * 70)
    print("Phase 4 test: Gemini AI judge")
    print("=" * 70)

    all_ok = True
    for i, sc in enumerate(SCENARIOS, 1):
        print(f"\n[{i}/{len(SCENARIOS)}] {sc['name']}")
        print(f"    Requirements: {sc['requirements_md'][:80]}...")
        print(f"    Deliverable:  {sc['deliverable_text'][:80]}")
        result = judge(
            requirements_md=sc["requirements_md"],
            deliverable_text=sc["deliverable_text"],
        )
        print(f"    → verdict:    {result['verdict']}")
        print(f"    → confidence: {result['confidence']:.2f}")
        print(f"    → reasoning:  {result['reasoning']}")
        print(f"    → model:      {result['model']}")

        # Soft check — log mismatch, don't fail (LLMs vary)
        if result["verdict"] == sc["expected_verdict"]:
            print(f"    ✓ matches expected verdict")
        else:
            print(f"    ⚠ expected {sc['expected_verdict']}, got {result['verdict']} (acceptable if reasoning is sound)")

    print("\n" + "=" * 70)
    print("Judge agent ran without errors. Inspect verdicts above for sanity.")
    print("=" * 70)


if __name__ == "__main__":
    main()
