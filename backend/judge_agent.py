"""
AI Judge — Gemini 2.0 Flash with structured JSON output.

Uses the new `google-genai` SDK (not the older `google-generativeai`).

Given a buyer's requirements (markdown) and a seller's deliverable (text or URL),
returns a verdict + reasoning + confidence score.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Optional, TypedDict

from google import genai
from google.genai import types as genai_types

from config import get_settings


MODEL_NAME = "gemini-2.0-flash"


class JudgeResult(TypedDict):
    verdict: str  # 'release' | 'refund' | 'needs_review'
    reasoning: str
    confidence: float
    model: str


_SYSTEM_PROMPT = """You are an impartial escrow adjudicator on the Arc blockchain.

A buyer locked USDC into an escrow with specific requirements. The seller has now submitted a deliverable.
Your job is to compare the deliverable against the requirements and decide:

- "release": the deliverable substantially meets the requirements → release USDC to seller.
- "refund": the deliverable does NOT meet the requirements (missing, off-topic, low quality, fraudulent) → refund USDC to buyer.
- "needs_review": the case is ambiguous and a human should decide → no automatic transfer.

Be strict but fair. Common reasons to refund:
- Empty or trivial deliverable
- Off-topic content
- Clearly AI-slop with no effort
- Missing required elements explicitly listed in the requirements

Common reasons to release:
- Deliverable addresses all stated requirements
- Reasonable quality for the stated effort/scope
- Minor flaws but core deliverable is present

Return a confidence score between 0.0 and 1.0:
- 1.0 = certain
- 0.5 = borderline
- < 0.5 = use "needs_review" instead

Respond ONLY with valid JSON matching the provided schema.
"""


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["release", "refund", "needs_review"]},
        "reasoning": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["verdict", "reasoning", "confidence"],
}


@lru_cache
def _client() -> genai.Client:
    s = get_settings()
    if not s.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in .env")
    return genai.Client(api_key=s.gemini_api_key)


def judge(
    requirements_md: str,
    deliverable_text: Optional[str] = None,
    deliverable_url: Optional[str] = None,
) -> JudgeResult:
    """Run the AI judge. At least one of deliverable_text/deliverable_url must be set."""
    if not deliverable_text and not deliverable_url:
        return {
            "verdict": "refund",
            "reasoning": "Seller submitted no deliverable content.",
            "confidence": 1.0,
            "model": MODEL_NAME,
        }

    deliverable_block = []
    if deliverable_text:
        deliverable_block.append(f"### Deliverable text\n\n{deliverable_text}")
    if deliverable_url:
        deliverable_block.append(f"### Deliverable URL\n\n{deliverable_url}")

    user_prompt = (
        f"## Buyer requirements\n\n{requirements_md}\n\n"
        + "\n\n".join(deliverable_block)
        + "\n\nJudge this submission. Respond with JSON only."
    )

    config = genai_types.GenerateContentConfig(
        system_instruction=_SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=_RESPONSE_SCHEMA,
        temperature=0.2,
    )

    response = _client().models.generate_content(
        model=MODEL_NAME,
        contents=user_prompt,
        config=config,
    )

    raw = (response.text or "").strip()
    parsed = json.loads(raw)

    # Defensive clamping
    confidence = float(parsed.get("confidence", 0.0))
    confidence = max(0.0, min(1.0, confidence))
    verdict = parsed.get("verdict", "needs_review")
    if verdict not in ("release", "refund", "needs_review"):
        verdict = "needs_review"

    # If model returned release/refund but confidence < 0.5, downgrade to needs_review
    if verdict in ("release", "refund") and confidence < 0.5:
        verdict = "needs_review"

    return {
        "verdict": verdict,
        "reasoning": parsed.get("reasoning", "").strip(),
        "confidence": confidence,
        "model": MODEL_NAME,
    }
