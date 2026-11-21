import secrets
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SessionStrategy, bearer_transport, get_session_strategy, get_user_manager
from app.core.auth_policy import require_local_auth_enabled
from app.core.database import get_async_session
from app.core.rate_limit import login_rate_limit
from app.core.redis import get_redis
from app.models.passkey import UserPasskey

router = APIRouter()

TEMP_TOKEN_TTL = 300  # 5 minutes


@router.post("/login", dependencies=[Depends(login_rate_limit), Depends(require_local_auth_enabled)])
async def login(
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager=Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
):
    user = await user_manager.authenticate(credentials)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="LOGIN_BAD_CREDENTIALS")

    available_methods = []
    if user.is_2fa_enabled and user.totp_secret:
        available_methods.append("totp")
        # A passkey doubles as a second factor only when the user explicitly
        # enabled 2FA. On its own it is a passwordless login alternative —
        # requiring it on top of the password would permanently lock the
        # account if the passkey is lost (there are no recovery codes).
        passkey_count = await session.scalar(
            select(func.count()).select_from(UserPasskey).where(UserPasskey.user_id == user.id)
        )
        if passkey_count and passkey_count > 0:
            available_methods.append("passkey")

    if available_methods:
        # Store temp token in Redis, return 2FA challenge
        r = await get_redis()
        temp_token = secrets.token_urlsafe(32)
        await r.set(
            f"2fa_temp:{temp_token}",
            json.dumps({"user_id": str(user.id), "available_methods": available_methods}),
            ex=TEMP_TOKEN_TTL,
        )
        return {"requires_2fa": True, "temp_token": temp_token, "available_methods": available_methods}

    token = await get_session_strategy(session).write_token(user)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
async def logout(
    token: str | None = Depends(bearer_transport.scheme),
    strategy: SessionStrategy = Depends(get_session_strategy),
):
    if token:
        await strategy.destroy_token(token)
    return {"detail": "Logged out"}
