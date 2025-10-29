# Windows Executor V2 (Skeleton)

This is a minimal FastAPI backend skeleton for the Windows Executor V2.

- User provides only API Key and API Secret from the web platform.
- Backend bootstraps by calling `/api/executor/config` on the platform.
- Subscribes to Pusher private channel `private-executor-{executorId}`.
- Integrates directly with MT5 via Python MetaTrader5 (no EA, no ZeroMQ).

## Dev Run

```
cd windows-executor-v2/backend
python -m venv .venv
. .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
export PLATFORM_URL=https://fx.nusanexus.com  # or set in your shell
uvicorn main:app --reload --port 8732
```

Then bootstrap from another terminal:

```
curl -X POST http://127.0.0.1:8732/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"api_key":"exe_xxx","api_secret":"<secret>"}'
```

## Notes
- Credentials are stored via Windows Credential Manager (keyring) when available.
- `/health` reports basic status; `/account` will initialize MT5 and return account info.
- This skeleton focuses on bootstrap flow and is safe to extend with strategy engine, risk manager, and ML modules.
