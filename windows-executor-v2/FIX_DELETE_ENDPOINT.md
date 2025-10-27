# Fix: Tambah Endpoint DELETE yang Sebenarnya

## Masalah
Endpoint `DELETE /api/strategies/{strategy_id}` saat ini hanya STOP strategy, tidak menghapus dari database.

## Solusi
Tambahkan endpoint baru untuk delete permanen dari database.

## Implementasi

### 1. Edit file `backend/api/strategies.py`

Tambahkan endpoint baru setelah endpoint yang sudah ada:

```python
@router.delete("/{strategy_id}/permanent", summary="Delete strategy from database permanently")
async def delete_strategy_permanent(strategy_id: str):
    """
    Permanently delete strategy from database.
    This will:
    1. Stop the strategy if it's running
    2. Delete all associated trade logs
    3. Delete the strategy from database
    """
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    # Stop strategy if running
    status = await strategy_executor.stop_strategy(strategy_id)
    
    # Delete from database
    try:
        with session_scope() as session:
            # Delete trade logs first (foreign key constraint)
            logs_deleted = session.query(TradeLog).filter(
                TradeLog.strategy_id == strategy_id
            ).delete()
            
            # Delete strategy
            strategy_deleted = session.query(StoredStrategy).filter(
                StoredStrategy.id == strategy_id
            ).delete()
            
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
            "was_running": status is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to delete strategy: {str(e)}"
        )


@router.delete("/{strategy_id}/batch", summary="Delete multiple strategies")
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
                ).delete()
                
                deleted = session.query(StoredStrategy).filter(
                    StoredStrategy.id == strategy_id
                ).delete()
                
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
```

### 2. Import yang diperlukan

Pastikan import ini ada di bagian atas file:

```python
from typing import Any, Dict, List
```

### 3. Testing

**Test delete single strategy:**
```bash
# DELETE request
curl -X DELETE http://localhost:8081/api/strategies/{strategy_id}/permanent
```

**Test delete multiple strategies:**
```bash
# POST request with JSON body
curl -X DELETE http://localhost:8081/api/strategies/batch \
  -H "Content-Type: application/json" \
  -d '["strategy-id-1", "strategy-id-2"]'
```

### 4. Frontend Integration

Update frontend untuk menggunakan endpoint baru:

```typescript
// Delete single strategy permanently
async function deleteStrategy(strategyId: string) {
  const response = await fetch(
    `${API_URL}/strategies/${strategyId}/permanent`,
    { method: 'DELETE' }
  );
  return response.json();
}

// Delete multiple strategies
async function deleteStrategies(strategyIds: string[]) {
  const response = await fetch(
    `${API_URL}/strategies/batch`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategyIds)
    }
  );
  return response.json();
}
```

## Alternatif: Soft Delete

Jika ingin menyimpan history, gunakan soft delete:

### 1. Update Model
```python
class StoredStrategy(Base):
    __tablename__ = "strategies"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # NEW
    is_deleted = Column(Boolean, default=False)   # NEW
```

### 2. Soft Delete Endpoint
```python
@router.delete("/{strategy_id}/soft", summary="Soft delete strategy")
async def soft_delete_strategy(strategy_id: str):
    """Mark strategy as deleted without removing from database."""
    from database import session_scope
    from database.models import StoredStrategy
    from datetime import datetime
    
    # Stop if running
    await strategy_executor.stop_strategy(strategy_id)
    
    # Soft delete
    try:
        with session_scope() as session:
            strategy = session.query(StoredStrategy).filter(
                StoredStrategy.id == strategy_id
            ).first()
            
            if not strategy:
                raise HTTPException(status_code=404, detail="Strategy not found")
            
            strategy.is_deleted = True
            strategy.deleted_at = datetime.utcnow()
        
        return {
            "success": True,
            "message": f"Strategy {strategy_id} soft deleted",
            "deleted_at": strategy.deleted_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3. Update List Endpoint untuk Filter Deleted
```python
@router.get("/available", summary="Get available strategies from platform")
async def get_available_strategies(include_deleted: bool = False) -> List[Dict[str, Any]]:
    """Fetch user's strategies from web platform."""
    from database import session_scope
    from database.models import StoredStrategy
    
    with session_scope() as session:
        query = session.query(StoredStrategy)
        
        if not include_deleted:
            query = query.filter(StoredStrategy.is_deleted == False)
        
        strategies = query.all()
        return [
            {
                "id": s.id,
                "name": s.name,
                "symbol": s.symbol,
                "timeframe": s.timeframe,
                "payload": s.payload,
                "is_deleted": s.is_deleted,
                "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None
            }
            for s in strategies
        ]
```

## Migration Database (jika pakai soft delete)

```python
# migration_add_soft_delete.py
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "windows-executor-v2.sqlite3"
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Add columns
cursor.execute("ALTER TABLE strategies ADD COLUMN deleted_at TEXT")
cursor.execute("ALTER TABLE strategies ADD COLUMN is_deleted INTEGER DEFAULT 0")

conn.commit()
conn.close()
print("✅ Migration completed")
```

## Kesimpulan

**Pilihan 1: Hard Delete (Recommended untuk production)**
- Menghapus data permanen
- Database lebih bersih
- Tidak bisa restore

**Pilihan 2: Soft Delete (Recommended untuk development)**
- Data masih tersimpan
- Bisa restore kapan saja
- Berguna untuk audit trail

**Sementara ini, gunakan script Python yang sudah dibuat:**
- `delete-strategy.py` - Hapus strategy tertentu
- `reset-strategies.py` - Hapus semua strategies
