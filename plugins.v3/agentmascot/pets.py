"""Read Codex Pet archives as data; keep imported artwork outside plugin code."""

import base64
import hashlib
import io
import json
import os
import re
import shutil
import stat
import tempfile
import threading
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image, UnidentifiedImageError

PET_LOCK = threading.RLock()
PET_ID = re.compile(r"pet_[0-9a-f]{32}\Z")
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_IMAGE = 20 * 1024 * 1024
FRAME_COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6]


class PetImportError(ValueError):
    """A user-correctable archive or asset error."""


def safe_name(name: str) -> str:
    parts = name.rstrip("/").split("/")
    if (not name or "\\" in name or "\x00" in name or ":" in name
            or any(part in {"", ".", ".."} for part in parts)):
        raise PetImportError("压缩包包含不支持的文件路径。")
    return "/".join(parts)


def inspect_archive(payload: bytes) -> tuple[dict, bytes]:
    """Validate one pet nested anywhere in a ZIP without extracting its files."""
    if not payload or len(payload) > MAX_ARCHIVE:
        raise PetImportError("请选择不超过 64 MiB 的 Pet ZIP。")
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            entries = archive.infolist()
            if len(entries) > 1024 or sum(item.file_size for item in entries) > 256 * 1024 * 1024:
                raise PetImportError("压缩包文件过多或解压后超过 256 MiB。")
            names = {}
            for item in entries:
                name = safe_name(item.filename)
                if name.casefold() in names:
                    raise PetImportError("压缩包包含重复路径。")
                if item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16):
                    raise PetImportError("不支持加密文件或符号链接。")
                names[name.casefold()] = item
            manifests = [item for item in entries if not item.is_dir()
                         and PurePosixPath(item.filename).name == "pet.json"]
            if len(manifests) != 1:
                raise PetImportError("压缩包须包含唯一的 pet.json；请将多个角色分别打包。")
            manifest = manifests[0]
            if manifest.file_size > 16384:
                raise PetImportError("pet.json 内容过大。")
            metadata = json.loads(archive.read(manifest).decode("utf-8-sig"))
            if not isinstance(metadata, dict):
                raise PetImportError("pet.json 必须是 JSON 对象。")
            sheet = metadata.get("spritesheetPath")
            if not isinstance(sheet, str):
                raise PetImportError("pet.json 缺少 spritesheetPath。")
            sheet = safe_name(sheet)
            image_name = str(PurePosixPath(manifest.filename).parent / sheet)
            member = names.get(image_name.casefold())
            if member is None or member.is_dir() or member.file_size > MAX_IMAGE:
                raise PetImportError("未找到动画图，或动画图超过 20 MiB。")
            image_bytes = archive.read(member)
    except (zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError, NotImplementedError,
            UnicodeError, json.JSONDecodeError, KeyError) as error:
        raise PetImportError("压缩包或 pet.json 无法读取，请重新导出。") from error

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            if image.format not in {"PNG", "WEBP"} or getattr(image, "n_frames", 1) != 1:
                raise PetImportError("动画图须为静态 PNG/WebP 精灵图。")
            version = { (1536, 1872): 1, (1536, 2288): 2 }.get(image.size)
            if version is None:
                raise PetImportError("动画图尺寸应为 1536×1872（v1）或 1536×2288（v2）。")
            declared = metadata.get("spriteVersionNumber", version)
            if type(declared) is not int or declared != version:
                raise PetImportError("声明的 Pet 版本与动画图尺寸不一致。")
            image.load()
            rgba = image.convert("RGBA")
            if rgba.getchannel("A").getextrema()[0] == 255:
                raise PetImportError("动画图缺少透明背景。")
            counts = FRAME_COUNTS + ([8, 8] if version == 2 else [])
            for row, count in enumerate(counts):
                for column in range(8):
                    alpha = rgba.crop((column * 192, row * 208, (column + 1) * 192,
                                       (row + 1) * 208)).getchannel("A")
                    if (column < count) != bool(alpha.getbbox()):
                        raise PetImportError(f"第 {row + 1} 行第 {column + 1} 格缺帧或占用了空白格。")
            thumbnail = rgba.crop((0, 0, 192, 208))
            thumbnail.thumbnail((72, 78))
            output = io.BytesIO()
            thumbnail.save(output, format="PNG")
            mime = "image/png" if image.format == "PNG" else "image/webp"
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise PetImportError("动画图损坏或无法解码。") from error
    name = metadata.get("displayName") or metadata.get("id") or "导入的 Pet"
    description = metadata.get("description", "")
    if not isinstance(name, str) or not isinstance(description, str):
        raise PetImportError("角色名称和说明必须是文本。")
    name, description = name.strip()[:80], description.strip()[:500]
    if not name:
        raise PetImportError("角色名称不能为空。")
    identity = json.dumps([name, description, version], ensure_ascii=False).encode() + image_bytes
    pet = {"id": "pet_" + hashlib.sha256(identity).hexdigest()[:32], "name": name,
           "description": description, "version": version, "rows": len(counts), "mime": mime,
           "sha256": hashlib.sha256(image_bytes).hexdigest(),
           "icon": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()}
    return pet, image_bytes


class PetStore:
    def __init__(self, root: Path):
        self.root = root / "pets"

    def directory(self, pet_id: str) -> Path:
        if not PET_ID.fullmatch(pet_id):
            raise PetImportError("无效的角色 ID。")
        directory = self.root / pet_id
        if not directory.resolve().is_relative_to(self.root.resolve()) or directory.is_symlink():
            raise PetImportError("无效的角色目录。")
        return directory

    def get(self, pet_id: str) -> dict:
        directory = self.directory(pet_id)
        try:
            pet = json.loads((directory / "pet.json").read_text("utf-8"))
            if pet["id"] != pet_id or not (directory / "sprite").is_file():
                raise PetImportError("角色文件不完整。")
            return pet
        except (OSError, ValueError, KeyError) as error:
            raise PetImportError("角色不存在或文件损坏。") from error

    def list(self) -> list[dict]:
        if not self.root.exists():
            return []
        result = []
        for path in sorted(self.root.iterdir()):
            if PET_ID.fullmatch(path.name):
                try:
                    result.append(self.get(path.name))
                except PetImportError:
                    continue
        return result

    def save(self, pet: dict, image_bytes: bytes) -> dict:
        with PET_LOCK:
            self.root.mkdir(parents=True, exist_ok=True)
            destination = self.directory(pet["id"])
            if destination.exists():
                existing = self.get(pet["id"])
                if hashlib.sha256((destination / "sprite").read_bytes()).hexdigest() != pet["sha256"]:
                    raise PetImportError("同名角色文件损坏，请移除后重新导入。")
                return existing
            if len(self.list()) >= 50:
                raise PetImportError("最多保留 50 个导入角色，请先移除不用的角色。")
            with tempfile.TemporaryDirectory(prefix=".import-", dir=self.root) as temporary:
                stage = Path(temporary)
                (stage / "sprite").write_bytes(image_bytes)
                (stage / "pet.json").write_text(json.dumps(pet, ensure_ascii=False), encoding="utf-8")
                os.rename(stage, destination)
            return pet

    def remove(self, pet_id: str, active_id: str) -> None:
        with PET_LOCK:
            if pet_id == active_id:
                raise PetImportError("请先保存切换到其他角色，再移除此角色。")
            directory = self.directory(pet_id)
            if directory.exists():
                shutil.rmtree(directory)


def pet_view(pet: dict, plugin_id: str, image_bytes: bytes | None = None) -> dict:
    view = {key: pet[key] for key in ("id", "name", "description", "version", "rows", "icon")}
    view["sprite_url"] = (f"data:{pet['mime']};base64," + base64.b64encode(image_bytes).decode()
                          if image_bytes is not None else f"/api/v1/plugin/{plugin_id}/pets/{pet['id']}/image")
    return view
