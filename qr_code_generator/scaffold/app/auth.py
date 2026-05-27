import os
from functools import lru_cache

import httpx
from fastapi import Header, HTTPException
from jose import jwt

CLERK_ISSUER = os.environ.get("CLERK_ISSUER", "")


@lru_cache(maxsize=1)
def _jwks() -> dict:
    if not CLERK_ISSUER:
        raise HTTPException(500, "CLERK_ISSUER env var not set")
    url = f"{CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json"
    return httpx.get(url, timeout=5).json()


def current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        keys = _jwks()["keys"]
        key = next((k for k in keys if k["kid"] == kid), None)
        if key is None:
            raise HTTPException(401, "Unknown signing key")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False},
        )
        return claims["sub"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}")
