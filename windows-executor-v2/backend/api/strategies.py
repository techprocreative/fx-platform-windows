from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from core import strategy_executor
from core.platform_api import WebPlatformAPI
from models import StrategyConfig, StrategyStatus


router = APIRouter()
platform_api = WebPlatformAPI()


@router.get("/", response_model=List[StrategyStatus], summary="Active strategies")
async def list_strategies():
    """List currently running strategies in executor."""
    return await strategy_executor.list_statuses()


@router.get("/available", summary="Get available strategies from platform")
async def get_available_strategies() -> List[Dict[str, Any]]:
    """Fetch user's strategies from web platform."""
    strategies = await platform_api.fetch_user_strategies()
    return strategies


@router.get("/assigned", summary="(Deprecated) Get active strategies assigned to this executor")
async def get_assigned_strategies() -> List[Dict[str, Any]]:
    """DEPRECATED: Strategies are now started via Pusher commands only.
    
    This endpoint returns empty list to maintain backward compatibility.
    Use Pusher commands (START_STRATEGY) from web platform instead.
    """
    return []  # No auto-sync - strategies start via commands only


@router.get("/{strategy_id}", summary="Get strategy details from platform")
async def get_strategy(strategy_id: str) -> Dict[str, Any]:
    """Fetch specific strategy from platform."""
    strategy = await platform_api.fetch_strategy_by_id(strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy


@router.post("/start", response_model=StrategyStatus, summary="Start strategy")
async def start_strategy(strategy: StrategyConfig):
    return await strategy_executor.start_strategy(strategy)


@router.post("/stop/{strategy_id}", response_model=StrategyStatus, summary="Stop strategy")
async def stop_strategy_post(strategy_id: str):
    status = await strategy_executor.stop_strategy(strategy_id)
    if not status:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return status


@router.delete("/{strategy_id}", response_model=StrategyStatus, summary="Stop strategy (DELETE)")
async def stop_strategy_delete(strategy_id: str):
    status = await strategy_executor.stop_strategy(strategy_id)
    if not status:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return status


@router.delete("/{strategy_id}/permanent", summary="Delete strategy permanently")
async def delete_strategy_permanent(strategy_id: str):
    """Permanently delete strategy from database and stop if running."""
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    # Stop strategy if running
    status = await strategy_executor.stop_strategy(strategy_id)
    was_running = status is not None
    
    # Delete from database
    try:
        with session_scope() as session:
            # Delete trade logs first (foreign key)
            logs_deleted = session.query(TradeLog).filter(
                TradeLog.strategy_id == strategy_id
            ).delete(synchronize_session=False)
            
            # Delete strategy
            strategy_deleted = session.query(StoredStrategy).filter(
                StoredStrategy.id == strategy_id
            ).delete(synchronize_session=False)
            
            if strategy_deleted == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Strategy not found in database"
                )
        
        return {
            "success": True,
            "message": f"Strategy {strategy_id} deleted permanently",
            "strategy_deleted": strategy_deleted,
            "trade_logs_deleted": logs_deleted,
            "was_running": was_running
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete strategy: {str(e)}"
        )


@router.delete("/batch", summary="Delete multiple strategies")
async def delete_strategies_batch(strategy_ids: List[str]):
    """Delete multiple strategies at once."""
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    results = {
        "success": [],
        "failed": [],
        "total": len(strategy_ids)
    }
    
    for strategy_id in strategy_ids:
        try:
            # Stop if running
            await strategy_executor.stop_strategy(strategy_id)
            
            # Delete from database
            with session_scope() as session:
                session.query(TradeLog).filter(
                    TradeLog.strategy_id == strategy_id
                ).delete(synchronize_session=False)
                
                deleted = session.query(StoredStrategy).filter(
                    StoredStrategy.id == strategy_id
                ).delete(synchronize_session=False)
                
                if deleted > 0:
                    results["success"].append(strategy_id)
                else:
                    results["failed"].append({
                        "id": strategy_id,
                        "reason": "Not found"
                    })
        except Exception as e:
            results["failed"].append({
                "id": strategy_id,
                "reason": str(e)
            })
    
    return results
