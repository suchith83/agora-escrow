import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ first, then fall back to project root
_BACKEND_ENV = Path(__file__).parent / ".env"
_ROOT_ENV = Path(__file__).parent.parent / ".env"
if _BACKEND_ENV.exists():
    load_dotenv(_BACKEND_ENV)
elif _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV)


class Settings:
    def __init__(self):
        self.circle_api_key = os.environ["CIRCLE_API_KEY"]
        self.circle_entity_secret = os.environ["CIRCLE_ENTITY_SECRET"]
        self.arc_rpc_url = os.environ.get("ARC_RPC_URL") or os.environ.get("JSON-RPC-endpoint", "")
        self.usdc_contract_address = os.environ.get(
            "USDC_CONTRACT_ADDRESS", "0x3600000000000000000000000000000000000000"
        )
        self.arc_blockchain = os.environ.get("ARC_BLOCKCHAIN", "ARC-TESTNET")
        self.supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
        self.supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.groq_api_key = os.environ.get("GROQ_API_KEY", "")
        self.frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3001")


@lru_cache
def get_settings() -> Settings:
    return Settings()
