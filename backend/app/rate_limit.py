import threading
import time
from collections import deque
from collections.abc import Hashable


class RateLimiter:
    """Sliding one-minute window per key, in memory: fine for the single backend process we run."""

    def __init__(self, window_seconds: float = 60):
        self.window = window_seconds
        self._hits: dict[Hashable, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: Hashable, limit: int) -> float | None:
        """Counts a request. None when it fits in the limit, else seconds until the next one would."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= limit:
                return hits[0] + self.window - now
            hits.append(now)
            # Drop idle keys now and then, so random user ids don't pile up.
            if len(self._hits) > 10_000:
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > now - self.window}
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
