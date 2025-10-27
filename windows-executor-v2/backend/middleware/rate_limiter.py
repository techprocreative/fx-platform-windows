"""Rate limiting middleware to prevent API abuse."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: defaultdict[str, deque] = defaultdict(lambda: deque())

    def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed."""
        now = time.time()
        window_start = now - self.window_seconds

        # Remove old requests outside the window
        request_times = self.requests[identifier]
        while request_times and request_times[0] < window_start:
            request_times.popleft()

        # Check if limit exceeded
        if len(request_times) >= self.max_requests:
            return False

        # Add current request
        request_times.append(now)
        return True

    def get_remaining(self, identifier: str) -> int:
        """Get remaining requests in current window."""
        now = time.time()
        window_start = now - self.window_seconds

        request_times = self.requests[identifier]
        # Count requests in current window
        recent_requests = sum(1 for t in request_times if t >= window_start)
        return max(0, self.max_requests - recent_requests)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limits."""

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.limiter = RateLimiter(max_requests, window_seconds)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health check
        if request.url.path == "/api/health":
            return await call_next(request)

        # Use IP address as identifier
        client_ip = request.client.host if request.client else "unknown"

        if not self.limiter.is_allowed(client_ip):
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.limiter.max_requests} requests per {self.limiter.window_seconds} seconds",
                    "retry_after": self.limiter.window_seconds,
                },
            )

        response = await call_next(request)

        # Add rate limit headers
        remaining = self.limiter.get_remaining(client_ip)
        response.headers["X-RateLimit-Limit"] = str(self.limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + self.limiter.window_seconds))

        return response


__all__ = ["RateLimiter", "RateLimitMiddleware"]
