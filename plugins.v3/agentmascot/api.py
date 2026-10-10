from collections.abc import Mapping
from pathlib import Path
from typing import Any

from app.sdk.logging import logger
from fastapi import HTTPException
from fastapi.responses import Response

from .config import apply_config_state
from .diagnostics import log_configuration
from .loader import build_loader_response
from .manifest import ACTION_SUMMARY, AVATAR_SUMMARY
from .models import (
    DeleteResponse,
    PetListResponse,
    PetResponse,
    PublicStatusResponse,
    StatusResponse,
)
from .pets import (
    MAX_ARCHIVE,
    PET_ID,
    PET_LOCK,
    PetImportError,
    inspect_archive,
    pet_view,
)


class AgentMascotApi:
    def __init__(self, plugin: Any, plugin_root: Path):
        self._plugin = plugin
        self._plugin_root = plugin_root
        self._missing_selected = None

    def _catalog(self):
        return [pet_view(pet, self._plugin.__class__.__name__) for pet in self._plugin._pets.list()]

    def _selected(self):
        selected = self._plugin._current_config()["mascot"]
        if not PET_ID.fullmatch(selected):
            self._missing_selected = None
            return None
        try:
            result = pet_view(self._plugin._pets.get(selected), self._plugin.__class__.__name__)
            self._missing_selected = None
            return result
        except PetImportError:
            if self._missing_selected != selected:
                logger.warning("所选桌宠资源缺失或损坏，页面入口无法显示: id=%s", selected)
                self._missing_selected = selected
            return None

    def get_status(self) -> StatusResponse:
        return StatusResponse(
            success=True,
            data={
                "config": self._plugin._current_config(),
                "pets": self._catalog(),
                "pet": self._selected(),
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
                "pet": self._selected(),
                "summary": {
                    "enabled": self._plugin.get_state(),
                    "replace_agent_entry": bool(getattr(self._plugin, "_replace_agent_entry", True)),
                },
            },
        )

    def get_loader(self) -> Response:
        response = build_loader_response(self._plugin_root)
        if response.status_code == 200:
            logger.info("桌宠入口脚本已提供: bytes=%s；此记录不代表浏览器已执行", len(response.body))
        return response

    def list_pets(self) -> PetListResponse:
        return PetListResponse(success=True, data={"pets": self._catalog()})

    def import_pet(self, upload, *, save=False) -> PetResponse:
        try:
            payload = upload.file.read(MAX_ARCHIVE + 1)
            pet, image_bytes = inspect_archive(payload)
            if save:
                pet = self._plugin._pets.save(pet, image_bytes)
            logger.info("Pet %s成功: id=%s name=%r version=%s rows=%s",
                        "导入或复用" if save else "预览校验", pet["id"], pet["name"], pet["version"], pet["rows"])
            return PetResponse(success=True, data={"pet": pet_view(
                pet, self._plugin.__class__.__name__, None if save else image_bytes)})
        except PetImportError as error:
            logger.warning("Pet %s失败: %s", "导入" if save else "预览校验", error)
            return PetResponse(success=False, message=str(error))
        except OSError as error:
            logger.error(f"保存 AgentMascot Pet 失败: {error}")
            return PetResponse(success=False, message="角色文件保存失败，请检查插件数据目录。")
        finally:
            upload.file.close()

    def delete_pet(self, pet_id: str) -> DeleteResponse:
        try:
            with PET_LOCK:
                self._plugin._pets.remove(pet_id, self._plugin._current_config()["mascot"])
            logger.info("Pet 移除完成: id=%s", pet_id)
            return DeleteResponse(success=True)
        except PetImportError as error:
            logger.warning("Pet 移除拒绝: %s", error)
            return DeleteResponse(success=False, message=str(error))
        except OSError as error:
            logger.error(f"移除 AgentMascot Pet 失败: {error}")
            return DeleteResponse(success=False, message="角色移除失败，请稍后重试。")

    def pet_image(self, pet_id: str) -> Response:
        try:
            with PET_LOCK:
                pet = self._plugin._pets.get(pet_id)
                content = (self._plugin._pets.directory(pet_id) / "sprite").read_bytes()
            return Response(content, media_type=pet["mime"], headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff", "ETag": f'"{pet["sha256"]}"',
            })
        except (PetImportError, OSError) as error:
            raise HTTPException(status_code=404, detail="角色图片不存在") from error

    def save_config(self, config: Mapping[str, Any]) -> StatusResponse:
        previous = self._plugin._current_config()
        try:
            apply_config_state(self._plugin, {**previous, **config})
            self._plugin._save_config()
            log_configuration(self._plugin, "桌宠配置保存完成", previous)
            return self.get_status()
        except Exception as error:  # noqa: BLE001 - Roll back state for any host persistence failure.
            apply_config_state(self._plugin, previous)
            logger.error(f"保存 Agent 桌宠配置失败: {error}")
            return StatusResponse(success=False, message="保存桌宠配置失败，请查看插件日志")
