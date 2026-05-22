"""
FastAPI app — Agora AI Escrow backend.

Run:
    cd backend && source .venv/bin/activate
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import escrow_service
from auth import current_user, current_user_optional
from config import get_settings
from models import (
    CreateEscrowRequest,
    CreateEscrowResponse,
    SubmitDeliverableRequest,
    SubmitDeliverableResponse,
    JudgeResponse,
    ReleaseResponse,
)


app = FastAPI(title="Agora AI Escrow", version="0.2.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agora-escrow"}


@app.get("/me")
def me(user: dict = Depends(current_user)):
    """Returns the authenticated user's profile + live wallet balance."""
    return escrow_service.get_profile_by_email(user["email"])


@app.post("/escrow/create", response_model=CreateEscrowResponse)
def create_escrow(req: CreateEscrowRequest, user: dict = Depends(current_user)):
    """Authenticated buyer creates an escrow. Buyer is taken from session, not form."""
    try:
        e = escrow_service.create_escrow(
            buyer_email=user["email"],
            seller_email=req.seller_email,
            amount_usdc=req.amount_usdc,
            title=req.title,
            requirements_md=req.requirements_md,
            buyer_profile=user,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return CreateEscrowResponse(
        escrow_id=e["id"],
        status=e["status"],
        escrow_wallet_address=e["circle_escrow_wallet_address"],
        fund_instructions=(
            f"Send {e['amount_usdc']} USDC on Arc Testnet to "
            f"{e['circle_escrow_wallet_address']} — or use the one-click 'Fund from my wallet' button."
        ),
    )


@app.post("/escrow/{escrow_id}/check-funding")
def check_funding(escrow_id: str):
    try:
        result = escrow_service.mark_funded(escrow_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "escrow_id": escrow_id,
        "status": result["status"],
        "check": result.get("_check", {}),
    }


@app.post("/escrow/{escrow_id}/fund-from-buyer")
def fund_from_buyer(escrow_id: str, user: dict = Depends(current_user)):
    try:
        return escrow_service.fund_from_buyer(escrow_id, actor_profile_id=user["id"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/profile")
def get_profile(email: str):
    try:
        return escrow_service.get_profile_by_email(email)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/escrow/{escrow_id}/submit", response_model=SubmitDeliverableResponse)
def submit(escrow_id: str, req: SubmitDeliverableRequest, user: dict = Depends(current_user)):
    if not req.content_text and not req.content_url:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of content_text or content_url",
        )
    try:
        d = escrow_service.submit_deliverable(
            escrow_id=escrow_id,
            content_text=req.content_text,
            content_url=req.content_url,
            actor_profile_id=user["id"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return SubmitDeliverableResponse(
        deliverable_id=d["id"],
        escrow_id=escrow_id,
        status="submitted",
    )


@app.post("/escrow/{escrow_id}/judge", response_model=JudgeResponse)
def judge(escrow_id: str, user: dict = Depends(current_user)):
    """Either party can trigger the judge — the AI is impartial regardless."""
    try:
        j = escrow_service.run_judge(escrow_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return JudgeResponse(
        judgment_id=j["id"],
        escrow_id=escrow_id,
        verdict=j["verdict"],
        reasoning=j["reasoning"],
        confidence=float(j["confidence"]),
        model=j["model"],
    )


@app.post("/escrow/{escrow_id}/settle", response_model=ReleaseResponse)
def settle(escrow_id: str, user: dict = Depends(current_user)):
    """Either party can execute the settle once a verdict exists."""
    try:
        result = escrow_service.settle(escrow_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return ReleaseResponse(
        escrow_id=escrow_id,
        status=result["status"],
        transfer_tx_id=result["transfer_tx_id"],
        transfer_state=result["transfer_state"],
    )


@app.get("/transaction/{tx_id}")
def get_transaction(tx_id: str):
    import circle_client as cc
    try:
        return cc.get_transaction(tx_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/escrow/{escrow_id}")
def get_escrow(escrow_id: str):
    """Public — anyone can read escrow details. The detail page uses /me to know the viewer's role."""
    try:
        return escrow_service.get_escrow_detail(escrow_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/me/escrows")
def my_escrows(user: dict = Depends(current_user)):
    """Authenticated dashboard: returns {as_buyer: [...], as_seller: [...]}."""
    return escrow_service.list_for_profile(user["id"])


@app.get("/escrow")
def list_escrows(limit: int = 20):
    """Public feed — anyone can browse."""
    return {"escrows": escrow_service.list_recent_escrows(limit=limit)}
