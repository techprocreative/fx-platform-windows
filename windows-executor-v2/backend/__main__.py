from __future__ import annotations

import os
import uvicorn

from main import app, configure_logging  # type: ignore


def main() -> None:
    configure_logging()
    port = int(os.getenv("PORT", "8732"))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
