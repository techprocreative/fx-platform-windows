# Analisis Database Backend Windows Executor V2
## Masalah: Strategi Tidak Bisa Dihapus

### 📊 Ringkasan Analisis

**Status Database:**
- File database: `windows-executor-v2.sqlite3`
- Lokasi: Root folder windows-executor-v2
- Status saat ini: Database kosong (belum ada tabel)
- Tabel akan dibuat otomatis saat backend pertama kali dijalankan

---

## 🔍 Penyebab Masalah

### 1. **DELETE Endpoint BUKAN untuk Menghapus dari Database**

File: `backend/api/strategies.py`
```python
@router.delete("/{strategy_id}", response_model=StrategyStatus, summary="Stop strategy (DELETE)")
async def stop_strategy_delete(strategy_id: str):
    status = await strategy_executor.stop_strategy(strategy_id)
    if not status:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return status
```

**Masalah:** Endpoint `DELETE` hanya **STOP strategy** (menghentikan), TIDAK menghapus dari database!

### 2. **Strategy Executor Hanya Mengubah Status**

File: `backend/core/strategy_executor.py`
```python
async def stop_strategy(self, strategy_id: str) -> Optional[StrategyStatus]:
    async with self._lock:
        data = self.active_strategies.get(strategy_id)
        if not data:
            return None
        data["status"] = "stopped"  # Hanya ubah status jadi "stopped"
        logger.info("Stopped strategy %s", strategy_id)
        return self._build_status(strategy_id)
```

**Masalah:** Method ini hanya mengubah status di memory, tidak menghapus row dari database.

### 3. **Strategy Disimpan Permanent di Database**

File: `backend/core/strategy_executor.py`
```python
def _persist_strategy(self, strategy: StrategyConfig) -> None:
    try:
        with session_scope() as session:
            model = session.get(StoredStrategy, strategy.id)
            payload = strategy.model_dump(by_alias=True)
            if model:
                model.name = strategy.name
                model.symbol = strategy.symbol
                model.timeframe = strategy.timeframe
                model.payload = payload
            else:
                session.add(
                    StoredStrategy(
                        id=strategy.id,
                        name=strategy.name,
                        symbol=strategy.symbol,
                        timeframe=strategy.timeframe,
                        payload=payload,
                    )
                )
    except Exception as exc:
        logger.debug("Failed to persist strategy %s: %s", strategy.id, exc)
```

**Masalah:** Strategy disimpan permanent ke database saat `start_strategy()`, tapi TIDAK ADA fungsi untuk menghapusnya!

---

## 📋 Schema Database

File: `backend/database/models.py`

```python
class StoredStrategy(Base):
    __tablename__ = "strategies"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**Tabel strategies menyimpan:**
- ID strategy (primary key)
- Nama strategy
- Symbol (e.g., EURUSD, XAUUSD)
- Timeframe (e.g., H1, H4)
- Payload (JSON lengkap berisi rules, settings, dll)
- Waktu dibuat

---

## ✅ Solusi

### **Opsi 1: Tambah Endpoint DELETE yang Sebenarnya (Recommended)**

Buat endpoint baru untuk menghapus strategy dari database:

File: `backend/api/strategies.py`
```python
@router.delete("/{strategy_id}/permanent", summary="Delete strategy from database")
async def delete_strategy_permanent(strategy_id: str):
    """Permanently delete strategy from database."""
    # Stop strategy if running
    await strategy_executor.stop_strategy(strategy_id)
    
    # Delete from database
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    try:
        with session_scope() as session:
            # Delete trade logs first (foreign key)
            session.query(TradeLog).filter(TradeLog.strategy_id == strategy_id).delete()
            
            # Delete strategy
            deleted = session.query(StoredStrategy).filter(StoredStrategy.id == strategy_id).delete()
            if deleted == 0:
                raise HTTPException(status_code=404, detail="Strategy not found in database")
            
        return {"success": True, "message": f"Strategy {strategy_id} deleted permanently"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")
```

### **Opsi 2: Manual Delete via Script (Temporary Fix)**

Gunakan script Python untuk menghapus langsung dari database:

```python
import sqlite3
from pathlib import Path

db_path = "windows-executor-v2/windows-executor-v2.sqlite3"
strategy_id = "YOUR_STRATEGY_ID_HERE"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Delete trade logs first
cursor.execute("DELETE FROM trade_logs WHERE strategy_id = ?", (strategy_id,))

# Delete strategy
cursor.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))

conn.commit()
print(f"Deleted strategy: {strategy_id}")
conn.close()
```

### **Opsi 3: Hapus Semua Strategies (Reset Database)**

```python
import sqlite3

db_path = "windows-executor-v2/windows-executor-v2.sqlite3"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("DELETE FROM trade_logs")
cursor.execute("DELETE FROM strategies")

conn.commit()
print("All strategies deleted")
conn.close()
```

---

## 🛠️ Cara Menggunakan

### 1. **Cek Strategies yang Ada**
```bash
python check-executor-db.py
```

### 2. **Hapus Strategy Tertentu**
```bash
python delete-strategy.py <strategy_id>
```

### 3. **Hapus Semua Strategies**
```bash
python reset-strategies.py
```

---

## 📌 Kesimpulan

**Masalah Utama:**
1. ❌ DELETE endpoint hanya STOP strategy, bukan delete dari database
2. ❌ Tidak ada API endpoint untuk menghapus strategy dari database
3. ❌ Strategy persisted permanent saat start, tidak ada cleanup

**Solusi:**
1. ✅ Tambah endpoint baru `/strategies/{id}/permanent` dengan method DELETE
2. ✅ Atau gunakan script Python untuk manual delete dari database
3. ✅ Database adalah SQLite biasa, bisa diedit dengan tools apapun

**Rekomendasi:**
- Implementasikan endpoint DELETE yang sebenarnya di API
- Tambah validasi: jangan izinkan delete strategy yang sedang running
- Tambah soft delete option (flag `deleted_at` instead of hard delete)
- Tambah confirmation di frontend sebelum delete
