import secrets
import uuid
from decimal import Decimal
from hashlib import sha256
from typing import Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, exceptions, schemas
from fastapi_users.authentication import AuthenticationBackend, BearerTransport
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_policy import require_local_auth_enabled
from app.core.config import get_settings
from app.core.database import get_async_session
from app.models.user import User
from app.models.user_session import UserSession

settings = get_settings()


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    user_db: SQLAlchemyUserDatabase
    reset_password_token_secret = settings.secret_key
    verification_token_secret = settings.secret_key

    async def update(
        self,
        user_update: schemas.BaseUserUpdate,
        user: User,
        safe: bool = False,
        request: Request | None = None,
    ) -> User:
        if user_update.password is not None:
            require_local_auth_enabled()
        return await super().update(user_update, user, safe=safe, request=request)

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")
        # If request is None, this was called programmatically (e.g., from setup endpoint)
        # which handles wallet creation, categories, and rules itself.
        if request is None:
            return
        # Create default wallet for users registered via /auth/register.
        from app.models.account import Account
        from app.services.category_service import create_default_categories
        from app.services.rule_service import create_default_rules
        from app.services.workspace_service import create_personal_workspace_for_user

        session = self.user_db.session
        currency = user.primary_currency
        lang = (user.preferences or {}).get("language", "en")

        # Every new user gets a Personal workspace + owner membership.
        # All their seeded data (wallet, categories, rules) reparent to it.
        workspace = await create_personal_workspace_for_user(session, user)

        wallet_name = "Carteira" if lang.startswith("pt") else "Wallet"
        wallet = Account(
            user_id=user.id,
            workspace_id=workspace.id,
            name=wallet_name,
            type="checking",
            balance=Decimal("0.00"),
            currency=currency,
        )
        session.add(wallet)
        await session.commit()

        # Create default categories and rules for the new user
        await create_default_categories(session, user.id, lang, workspace_id=workspace.id)
        await create_default_rules(session, user.id, lang, workspace_id=workspace.id)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl="/api/auth/login")


class SessionStrategy:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def read_token(
        self, token: str | None, user_manager: BaseUserManager[User, uuid.UUID]
    ) -> User | None:
        if not token:
            return None
        user_session = await self.session.get(UserSession, sha256(token.encode()).hexdigest())
        if user_session is None:
            return None
        try:
            return await user_manager.get(user_session.user_id)
        except exceptions.UserNotExists:
            return None

    async def write_token(self, user: User) -> str:
        token = secrets.token_urlsafe(32)
        self.session.add(UserSession(token_hash=sha256(token.encode()).hexdigest(), user_id=user.id))
        await self.session.commit()
        return token

    async def destroy_token(self, token: str, user: User | None = None) -> None:
        await self.session.execute(
            delete(UserSession).where(UserSession.token_hash == sha256(token.encode()).hexdigest())
        )
        await self.session.commit()


def get_session_strategy(session: AsyncSession = Depends(get_async_session)) -> SessionStrategy:
    return SessionStrategy(session)


auth_backend = AuthenticationBackend(
    name="session",
    transport=bearer_transport,
    get_strategy=get_session_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
