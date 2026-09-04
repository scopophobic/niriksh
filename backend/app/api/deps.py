from collections.abc import Generator

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, secure_equal
from app.db.models import User

bearer = HTTPBearer(auto_error=False)


def get_db(request: Request) -> Generator[Session, None, None]:
    with request.app.state.database.session_factory() as session:
        yield session


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_internal_api_key: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User | None:
    settings = request.app.state.settings
    if secure_equal(x_internal_api_key, settings.internal_api_key):
        return None
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_access_token(credentials.credentials, settings)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from None
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is unavailable")
    return user


def require_officer(user: User | None = Depends(get_current_user)) -> User | None:
    if user is not None and user.role not in {"triage", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officer role required")
    return user


def require_admin(user: User | None = Depends(get_current_user)) -> User | None:
    if user is not None and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def require_bhumika_integration(
    request: Request,
    x_niriksh_integration_key: str = Header(default="", alias="X-Niriksh-Integration-Key"),
) -> None:
    configured = request.app.state.settings.bhumika_integration_key
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bhumika integration is not configured")
    if not secure_equal(x_niriksh_integration_key, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration credential")
