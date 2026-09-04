import asyncio
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """
    Manages active WebSocket connections for live SOC dashboard streaming.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message over WebSocket: {e}")
                dead_connections.append(connection)

        for conn in dead_connections:
            self.disconnect(conn)

    def broadcast_sync(self, message: dict):
        """
        Synchronous thread-safe wrapper for broadcasting WebSocket messages.
        """
        if not self.active_connections:
            return
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(self.broadcast(message))
        except RuntimeError:
            # No running event loop in thread; schedule safely
            try:
                asyncio.run(self.broadcast(message))
            except Exception as e:
                logger.debug(f"Could not dispatch sync WebSocket broadcast: {e}")


ws_manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time alert notifications and traffic metrics streaming.
    """
    await ws_manager.connect(websocket)
    try:
        # Initial greeting / connection status
        await websocket.send_json({
            "event": "connected",
            "message": "Connected to PassiveGuard AI Realtime Stream"
        })
        while True:
            # Keep connection open and await any client ping/heartbeats
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket connection exception: {e}")
        ws_manager.disconnect(websocket)
