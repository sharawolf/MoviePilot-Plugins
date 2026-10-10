from collections.abc import Mapping
from pathlib import Path
from typing import Any

from app.sdk.logging import logger
from fastapi import HTTPException
from fastapi.responses import Response

from .config import apply_config_state
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

    def _catalog(self):
        return [pet_view(pet, self._plugin.__class__.__name__) for pet in self._plugin._pets.list()]

    def _selected(self):
        selected = self._plugin._current_config()["mascot"]
        if not PET_ID.fullmatch(selected):
            return None
        try:
            return pet_view(self._plugin._pets.get(selected), self._plugin.__class__.__name__)
        except PetImportError:
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
        return build_loader_response(self._plugin_root)

    def list_pets(self) -> PetListResponse:
        return PetListResponse(success=True, data={"pets": self._catalog()})

    def import_pet(self, upload, *, save=False) -> PetResponse:
        try:
            payload = upload.file.read(MAX_ARCHIVE + 1)
            pet, image_bytes = inspect_archive(payload)
            if save:
                pet = self._plugin._pets.save(pet, image_bytes)
            return PetResponse(success=True, data={"pet": pet_view(
                pet, self._plugin.__class__.__name__, None if save else image_bytes)})
        except PetImportError as error:
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
            return DeleteResponse(success=True)
        except PetImportError as error:
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
            return self.get_status()
        except Exception as error:  # noqa: BLE001 - Roll back state for any host persistence failure.
            apply_config_state(self._plugin, previous)
            logger.error(f"保存 Agent 桌宠配置失败: {error}")
            return StatusResponse(success=False, message="保存桌宠配置失败，请查看插件日志")
