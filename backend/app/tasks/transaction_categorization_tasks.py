"""Background categorization for newly synced bank transactions."""
from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.models.transaction import Transaction
from app.services.transaction_categorization_service import (
    CATEGORIZATION_BATCH_SIZE,
    categorize_uncategorized_transactions,
)
from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.transaction_categorization_tasks.categorize_transaction_batch",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def categorize_transaction_batch(
    self,
    transaction_id_strings: list[str],
    user_id_string: str,
    workspace_id_string: str,
    provider_name: str,
) -> dict:
    """Run one bounded batch in a fresh async event loop and DB pool."""
    if provider_name.casefold() != "pluggy":
        return {"categorized": 0, "reason": "unsupported provider"}

    try:
        transaction_ids = list(
            dict.fromkeys(uuid.UUID(value) for value in transaction_id_strings)
        )
        user_id = uuid.UUID(user_id_string)
        workspace_id = uuid.UUID(workspace_id_string)
    except (TypeError, ValueError, AttributeError):
        return {"categorized": 0, "reason": "invalid task arguments"}

    if not transaction_ids:
        return {"categorized": 0, "reason": "empty batch"}
    if len(transaction_ids) > CATEGORIZATION_BATCH_SIZE:
        return {"categorized": 0, "reason": "batch too large"}

    try:
        return asyncio.run(
            _categorize_batch(transaction_ids, user_id, workspace_id, provider_name)
        )
    except Exception as exc:  # noqa: BLE001 - retry transient DB/runtime failures
        logger.exception("Background transaction categorization task failed")
        raise self.retry(exc=exc)


async def _categorize_batch(
    transaction_ids: list[uuid.UUID],
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    provider_name: str,
) -> dict:
    # Each Celery task owns its event loop. NullPool prevents asyncpg connections
    # from surviving into the next asyncio.run() invocation in prefork workers.
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    session_maker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
        async with session_maker() as session:
            transactions = list(
                (
                    await session.execute(
                        select(Transaction)
                        .where(
                            Transaction.id.in_(transaction_ids),
                            Transaction.user_id == user_id,
                            Transaction.workspace_id == workspace_id,
                            Transaction.source == "sync",
                            Transaction.category_id.is_(None),
                            Transaction.is_ignored.is_(False),
                            Transaction.transfer_pair_id.is_(None),
                        )
                        .order_by(Transaction.date, Transaction.id)
                    )
                )
                .scalars()
                .all()
            )
            categorized = await categorize_uncategorized_transactions(
                session,
                user_id=user_id,
                workspace_id=workspace_id,
                provider_name=provider_name,
                transactions=transactions,
            )
            await session.commit()
            return {"categorized": categorized, "considered": len(transactions)}
    finally:
        await engine.dispose()
