import io
import os
from datetime import datetime

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from .auth import current_user
from .database import get_db
from .models import ScanEvent, UrlMapping
from .schemas import CreateRequest, CreateResponse, QRInfoResponse, UpdateRequest
from .token_gen import generate_token
from .url_validator import validate_url

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# In-memory cache (simulates Redis for prototype)
redirect_cache: dict[str, str] = {}

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
NO_STORE = {"Cache-Control": "no-store"}


def _to_create_response(mapping: UrlMapping) -> CreateResponse:
    return CreateResponse(
        token=mapping.token,
        short_url=f"{BASE_URL}/r/{mapping.token}",
        qr_code_url=f"{BASE_URL}/api/qr/{mapping.token}/image",
        original_url=mapping.original_url,
    )


@router.post("/api/qr/create", response_model=CreateResponse)
@limiter.limit("10/minute")
def create_qr(
    req: CreateRequest,
    request: Request,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    try:
        normalized_url = validate_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    existing = (
        db.query(UrlMapping)
        .filter(
            UrlMapping.user_id == user_id,
            UrlMapping.original_url == normalized_url,
            UrlMapping.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if existing and (existing.expires_at is None or existing.expires_at > datetime.utcnow()):
        return _to_create_response(existing)

    token = generate_token(normalized_url, user_id, db)
    mapping = UrlMapping(
        token=token,
        original_url=normalized_url,
        expires_at=req.expires_at,
        user_id=user_id,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    redirect_cache[token] = normalized_url
    return _to_create_response(mapping)


@router.get("/r/{token}")
def redirect(token: str, request: Request, db: Session = Depends(get_db)):
    """Cache → DB → 302/410/404 fallback flow."""
    target = redirect_cache.get(token)
    if target is not None:
        _record_scan(token, request, db)
        return RedirectResponse(target, status_code=302, headers=NO_STORE)

    mapping = db.query(UrlMapping).filter(UrlMapping.token == token).first()
    if mapping is None:
        raise HTTPException(status_code=404, detail="Not Found")
    if mapping.is_deleted or (mapping.expires_at and mapping.expires_at < datetime.utcnow()):
        raise HTTPException(status_code=410, detail="Gone")

    redirect_cache[token] = mapping.original_url
    _record_scan(token, request, db)
    return RedirectResponse(mapping.original_url, status_code=302, headers=NO_STORE)


@router.get("/api/qr/list", response_model=list[QRInfoResponse])
def list_qrs(
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(UrlMapping)
        .filter(UrlMapping.user_id == user_id, UrlMapping.is_deleted == False)  # noqa: E712
        .order_by(UrlMapping.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/api/qr/{token}", response_model=QRInfoResponse)
def get_qr_info(
    token: str,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_or_404(token, user_id, db)


@router.patch("/api/qr/{token}", response_model=QRInfoResponse)
def update_qr(
    token: str,
    req: UpdateRequest,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    mapping = _get_owned_or_404(token, user_id, db)

    if req.url is not None:
        try:
            mapping.original_url = validate_url(req.url)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        redirect_cache.pop(token, None)

    if req.expires_at is not None:
        mapping.expires_at = req.expires_at
        redirect_cache.pop(token, None)

    db.commit()
    db.refresh(mapping)
    return mapping


@router.delete("/api/qr/{token}")
def delete_qr(
    token: str,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    mapping = _get_owned_or_404(token, user_id, db)
    mapping.is_deleted = True
    db.commit()
    redirect_cache.pop(token, None)
    return {"detail": "Deleted"}


@router.get("/api/qr/{token}/image")
def get_qr_image(token: str, db: Session = Depends(get_db)):
    """Public — image just encodes the public short URL."""
    mapping = db.query(UrlMapping).filter(UrlMapping.token == token).first()
    if mapping is None or mapping.is_deleted:
        raise HTTPException(status_code=404, detail="Not Found")

    short_url = f"{BASE_URL}/r/{token}"
    img = qrcode.make(short_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.get("/api/qr/{token}/analytics")
def get_analytics(
    token: str,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    _get_owned_or_404(token, user_id, db)

    total = db.query(func.count(ScanEvent.id)).filter(ScanEvent.token == token).scalar()

    daily = (
        db.query(
            func.date(ScanEvent.scanned_at).label("date"),
            func.count(ScanEvent.id).label("count"),
        )
        .filter(ScanEvent.token == token)
        .group_by(func.date(ScanEvent.scanned_at))
        .order_by(func.date(ScanEvent.scanned_at))
        .all()
    )

    return {
        "token": token,
        "total_scans": total,
        "scans_by_day": [{"date": str(row.date), "count": row.count} for row in daily],
    }


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


def _get_owned_or_404(token: str, user_id: str, db: Session) -> UrlMapping:
    mapping = db.query(UrlMapping).filter(UrlMapping.token == token).first()
    if mapping is None or mapping.is_deleted or mapping.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not Found")
    return mapping


def _record_scan(token: str, request: Request, db: Session):
    event = ScanEvent(
        token=token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(event)
    db.commit()
