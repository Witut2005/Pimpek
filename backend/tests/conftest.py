import pytest

from app.main import ai_rate_limiter


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Every test starts with an empty AI rate limit, whatever ran before it."""
    ai_rate_limiter.reset()
    yield
    ai_rate_limiter.reset()
