from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_password
from app.db.models import User
from app.modules.auth.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    settings = request.app.state.settings
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, settings),
        role=user.role,
        expires_in=settings.access_token_minutes * 60,
    )


@router.get("/me")
def me(user: User | None = Depends(get_current_user)) -> dict:
    if user is None:
        return {"id": "internal", "email": "service@niriksh.internal", "role": "admin"}
    return {"id": user.id, "email": user.email, "role": user.role}
