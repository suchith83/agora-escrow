"""Pydantic request/response models."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class CreateEscrowRequest(BaseModel):
    # buyer_email is taken from the authenticated session, not the form
    seller_email: str
    amount_usdc: Decimal = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    requirements_md: str = Field(min_length=1)


class CreateEscrowResponse(BaseModel):
    escrow_id: str
    status: str
    escrow_wallet_address: str
    fund_instructions: str


class SubmitDeliverableRequest(BaseModel):
    content_text: Optional[str] = None
    content_url: Optional[str] = None


class SubmitDeliverableResponse(BaseModel):
    deliverable_id: str
    escrow_id: str
    status: str


class JudgeResponse(BaseModel):
    judgment_id: str
    escrow_id: str
    verdict: Literal["release", "refund", "needs_review"]
    reasoning: str
    confidence: float
    model: str


class ReleaseResponse(BaseModel):
    escrow_id: str
    status: str
    transfer_tx_id: Optional[str] = None
    transfer_state: Optional[str] = None


class EscrowDetail(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    buyer_profile_id: str
    seller_profile_id: str
    amount_usdc: str
    title: str
    requirements_md: str
    status: str
    circle_escrow_wallet_address: Optional[str] = None
