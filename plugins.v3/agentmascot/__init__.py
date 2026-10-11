from pathlib import Path
from typing import Annotated, Any

from app.sdk.logging import logger
from app.sdk.plugin import _PluginBase
from fastapi import Body, File, UploadFile
from fastapi.responses import Response

from .api import AgentMascotApi
from .config import apply_config_state, current_config_state
from .diagnostics import log_configuration
from .manifest import (
    AUTH_LEVEL,
    AUTHOR_URL,
    PLUGIN_AUTHOR,
    PLUGIN_CONFIG_PREFIX,
    PLUGIN_DESC,
    PLUGIN_ICON,
    PLUGIN_NAME,
    PLUGIN_ORDER,
    SIDEBAR_NAV_ICON,
    SIDEBAR_NAV_PERMISSION,
    SIDEBAR_NAV_SECTION,
    SIDEBAR_NAV_TITLE,
)
from .models import (
    DeleteResponse,
    PetListResponse,
    PetResponse,
    PublicStatusResponse,
    StatusResponse,
)
from .pets import PET_ID, PET_LOCK, PetStore


class AgentMascot(_PluginBase):
    """
    Agent 桌宠与 Codex Pet 角色库。
    """

    plugin_name = PLUGIN_NAME
    plugin_desc = PLUGIN_DESC
    plugin_icon = PLUGIN_ICON
    plugin_version = "3.0.0"
    plugin_author = PLUGIN_AUTHOR
    author_url = AUTHOR_URL
    plugin_config_prefix = PLUGIN_CONFIG_PREFIX
    plugin_order = PLUGIN_ORDER
    auth_level = AUTH_LEVEL

    def init_plugin(self, config: dict | None = None):
        with PET_LOCK:
            self._pets = PetStore(self.get_data_path())
            self._api = AgentMascotApi(self, Path(__file__).resolve().parent)
            apply_config_state(self, config)
            try:
                self._save_config()
            except Exception:
                logger.error("桌宠初始化失败: 配置持久化失败")
                raise
            self._stopped = False
            log_configuration(self, "桌宠初始化完成")

    def get_state(self) -> bool:
        return bool(getattr(self, "_enabled", False))

    @staticmethod
    def get_render_mode() -> tuple[str, str]:
        return "vue", "dist/assets"

    def get_agent_pets(self) -> list[dict[str, Any]]:
        """Let the V3.1.4 host own selection and page-session lifecycle."""
        if (not self.get_state() or getattr(self, "_stopped", True)
                or not getattr(self, "_replace_agent_entry", True)):
            return []
        return [{
            "key": "mascot",
            "name": "Agent 桌宠",
            "description": "使用桌宠插件中选定的角色、动作与跟随设置",
            "mode": "stage",
            "component": "AgentPet",
            "api_version": 1,
            "bubbles": "host",
        }]

    @staticmethod
    def get_command() -> list[dict[str, Any]]:
        return []

    def get_api(self) -> list[dict[str, Any]]:
        return [
            {"path": "/pets", "endpoint": self.list_pets, "methods": ["GET"],
             "auth": "bear", "response_model": PetListResponse, "summary": "列出导入角色"},
            {"path": "/pets/inspect", "endpoint": self.inspect_pet, "methods": ["POST"],
             "auth": "bear", "response_model": PetResponse, "summary": "预览 Codex Pet ZIP"},
            {"path": "/pets/import", "endpoint": self.import_pet, "methods": ["POST"],
             "auth": "bear", "response_model": PetResponse, "summary": "保存 Codex Pet ZIP"},
            {"path": "/pets/{pet_id}", "endpoint": self.delete_pet, "methods": ["DELETE"],
             "auth": "bear", "response_model": DeleteResponse, "summary": "移除未使用的导入角色"},
            {"path": "/pets/{pet_id}/image", "endpoint": self.pet_image, "methods": ["GET"],
             "allow_anonymous": True, "summary": "读取内容寻址的桌宠图片"},
            {
                "path": "/status",
                "endpoint": self.get_status,
                "methods": ["GET"],
                "auth": "bear",
                "response_model": StatusResponse,
                "summary": "获取 Agent 桌宠配置",
            },
            {
                "path": "/public_status",
                "endpoint": self.get_public_status,
                "methods": ["GET"],
                "allow_anonymous": True,
                "response_model": PublicStatusResponse,
                "summary": "获取 Agent 桌宠全局入口公开配置",
            },
            {
                "path": "/config",
                "endpoint": self.save_config_api,
                "methods": ["POST"],
                "auth": "bear",
                "response_model": StatusResponse,
                "summary": "保存 Agent 桌宠配置",
            },
            {
                "path": "/loader",
                "endpoint": self.get_loader,
                "methods": ["GET"],
                "auth": "bear",
                "summary": "获取 Agent 桌宠全局入口脚本",
            },
        ]

    def get_form(self) -> tuple[list[dict], dict[str, Any]]:
        return [], self._current_config()

    def get_page(self) -> list[dict]:
        return []

    def get_sidebar_nav(self) -> list[dict[str, Any]]:
        if not self.get_state() or not getattr(self, "_show_sidebar_nav", True):
            return []
        return [
            {
                "nav_key": "main",
                "title": SIDEBAR_NAV_TITLE,
                "icon": SIDEBAR_NAV_ICON,
                "section": SIDEBAR_NAV_SECTION,
                "permission": SIDEBAR_NAV_PERMISSION,
                "order": PLUGIN_ORDER,
            }
        ]

    def stop_service(self):
        if not getattr(self, "_stopped", True):
            logger.info("桌宠后端停止: instance=%s；页面入口由下一次配置检查更新", self.__class__.__name__)
            self._stopped = True

    def _current_config(self) -> dict[str, Any]:
        return current_config_state(self)

    def _save_config(self) -> None:
        self.update_config(self._current_config())

    def get_status(self) -> StatusResponse:
        return self._api.get_status()

    def get_public_status(self) -> PublicStatusResponse:
        return self._api.get_public_status()

    def get_loader(self) -> Response:
        return self._api.get_loader()

    def save_config_api(self, config: Annotated[dict, Body()]) -> StatusResponse:
        with PET_LOCK:
            selected = str(config.get("mascot", ""))
            if PET_ID.fullmatch(selected):
                try:
                    self._pets.get(selected)
                except ValueError:
                    logger.warning("桌宠配置保存拒绝: 所选角色不存在，id=%s", selected)
                    return StatusResponse(success=False, message="请先导入此角色。")
            return self._api.save_config(config)

    def list_pets(self) -> PetListResponse:
        return self._api.list_pets()

    def inspect_pet(self, file: Annotated[UploadFile, File()]) -> PetResponse:
        return self._api.import_pet(file)

    def import_pet(self, file: Annotated[UploadFile, File()]) -> PetResponse:
        return self._api.import_pet(file, save=True)

    def delete_pet(self, pet_id: str) -> DeleteResponse:
        return self._api.delete_pet(pet_id)

    def pet_image(self, pet_id: str) -> Response:
        return self._api.pet_image(pet_id)
