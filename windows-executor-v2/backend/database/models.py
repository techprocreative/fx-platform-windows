from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text

from .connection import Base


class StoredStrategy(Base):
    __tablename__ = "strategies"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TradeLog(Base):
    __tablename__ = "trade_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_id = Column(String, index=True, nullable=False)
    ticket = Column(String, nullable=False)
    direction = Column(String, nullable=False)
    volume = Column(String, nullable=False)
    open_price = Column(String, nullable=False)
    close_price = Column(String, nullable=True)
    extra = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    level = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


__all__ = ["StoredStrategy", "TradeLog", "SystemLog"]
