from __future__ import annotations

# Public API of the autoposter package
from .manager import Autoposter  # noqa: F401
from .logging import safe_log  # noqa: F401

# Singleton instance imported by API routers and app startup
autoposter = Autoposter()


