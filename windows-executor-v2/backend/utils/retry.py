"""Retry utilities with exponential backoff."""

from __future__ import annotations

import asyncio
import logging
from functools import wraps
from typing import Callable, Tuple, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


def async_retry(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Callable[[int, float, Exception], None] | None = None,
):
    """
    Retry decorator with exponential backoff for async functions.

    Args:
        max_attempts: Maximum number of attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Optional callback on retry (attempt, delay, exception)
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        logger.error(
                            f"Failed after {max_attempts} attempts: {func.__name__}",
                            exc_info=True,
                        )
                        raise

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )

                    if on_retry:
                        try:
                            on_retry(attempt, delay, e)
                        except Exception as callback_error:
                            logger.error(f"Retry callback failed: {callback_error}")

                    await asyncio.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)

            if last_exception:
                raise last_exception

        return wrapper

    return decorator


def sync_retry(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Callable[[int, float, Exception], None] | None = None,
):
    """
    Retry decorator with exponential backoff for sync functions.

    Args:
        max_attempts: Maximum number of attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Optional callback on retry (attempt, delay, exception)
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            import time

            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        logger.error(
                            f"Failed after {max_attempts} attempts: {func.__name__}",
                            exc_info=True,
                        )
                        raise

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )

                    if on_retry:
                        try:
                            on_retry(attempt, delay, e)
                        except Exception as callback_error:
                            logger.error(f"Retry callback failed: {callback_error}")

                    time.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)

            if last_exception:
                raise last_exception

        return wrapper

    return decorator


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""

    pass


__all__ = ["async_retry", "sync_retry", "CircuitBreakerError"]
