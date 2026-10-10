from pathlib import Path
from typing import Any, Mapping

from fastapi.responses import Response

from app.sdk.logging import logger
from .config import apply_config_state
from .loader import build_loader_response
from .manifest import ACTION_SUMMARY, AVATAR_SUMMARY
from .models import PublicStatusResponse, StatusResponse


class AgentMascotApi:
    def __init__(self, plugin: Any, plugin_root: Path):
        self._plugin = plugin
        self._plugin_root = plugin_root

    def get_status(self) -> StatusResponse:
        return StatusResponse(
            success=True,
            data={
                "config": self._plugin._current_config(),
                "summary": {
                    "enabled": self._plugin.get_state(),
                    "replace_agent_entry": bool(getattr(self._plugin, "_replace_agent_entry", True)),
                    "avatar": AVATAR_SUMMARY,
                    "actions": ACTION_SUMMARY,
                },
            },
        )

    def get_public_status(self) -> PublicStatusResponse:
        return PublicStatusResponse(
            success=True,
            data={
                "config": self._plugin._current_config(),
                "summary": {
                    "enabled": self._plugin.get_state(),
                    "replace_agent_entry": bool(getattr(self._plugin, "_replace_agent_entry", True)),
                },
            },
        )

    def get_loader(self) -> Response:
        return build_loader_response(self._plugin_root)

    def save_config(self, config: Mapping[str, Any]) -> StatusResponse:
        previous = self._plugin._current_config()
        try:
            apply_config_state(self._plugin, {**previous, **config})
            self._plugin._save_config()
            return self.get_status()
        except Exception as err:
            apply_config_state(self._plugin, previous)
            logger.error(f"保存 Agent 桌宠配置失败: {err}")
            return StatusResponse(success=False, message="保存桌宠配置失败，请查看插件日志")
