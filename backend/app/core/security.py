import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import Settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$%s$%s" % (base64.urlsafe_b64encode(salt).decode(), base64.urlsafe_b64encode(digest).decode())


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_text, digest_text = encoded.split("$", 2)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(digest_text)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "iss": "niriksh-api",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], issuer="niriksh-api")


def create_tracking_token(complaint_id: str, reference: str, created_at: datetime, settings: Settings) -> str:
    issued_at = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    payload = {
        "sub": complaint_id,
        "ref": reference,
        "type": "public_tracking",
        "iat": issued_at,
        "exp": issued_at + timedelta(days=settings.tracking_token_days),
        "iss": "niriksh-tracking",
        "aud": "niriksh-public-portal",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_tracking_token(token: str, settings: Settings) -> dict:
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        issuer="niriksh-tracking",
        audience="niriksh-public-portal",
    )
    if payload.get("type") != "public_tracking":
        raise jwt.InvalidTokenError("Invalid tracking-token type")
    return payload


def secure_equal(left: str, right: str) -> bool:
    return bool(left and right) and hmac.compare_digest(left.encode(), right.encode())
