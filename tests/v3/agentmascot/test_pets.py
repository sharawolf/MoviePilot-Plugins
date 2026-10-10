"""Pet ZIP contracts, isolated storage and real HTTP import lifecycle."""

import io
import json
import zipfile

import pytest
from app.plugins.agentmascot import AgentMascot
from app.sdk.logging import logger
from app.plugins.agentmascot.pets import (
    FRAME_COUNTS,
    PetImportError,
    PetStore,
    inspect_archive,
)
from fastapi import FastAPI, UploadFile
from fastapi.testclient import TestClient
from PIL import Image


def archive(version=2, prefix="", metadata=None, extra=None, bad_frame=False, cells=None, opaque=False):
    image = Image.new("RGBA", (1536, 2288 if version == 2 else 1872), (255, 255, 255, 255) if opaque else 0)
    if cells is None:
        cells = [(row, column) for row, count in enumerate(FRAME_COUNTS + ([8, 8] if version == 2 else []))
                 for column in range(count)]
    for row, column in cells:
        image.paste((40, 100, 150, 255), (column*192+50, row*208+60, column*192+110, row*208+170))
    if bad_frame:
        image.paste((0, 0, 0, 0), (0, 0, 192, 208))
    output = io.BytesIO()
    image.save(output, format="PNG")
    pet = {"id":"example", "displayName":"测试角色", "spritesheetPath":"sprite.png",
           "spriteVersionNumber":version, **(metadata or {})}
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as pack:
        pack.writestr(prefix + "pet.json", json.dumps(pet))
        pack.writestr(prefix + "sprite.png", output.getvalue())
        for name, data in (extra or {}).items():
            pack.writestr(name, data)
    return result.getvalue()


@pytest.mark.parametrize("version,prefix", [(1,""), (2,""), (2,"backup/package/")])
def test_supported_layouts(version, prefix):
    pet, image = inspect_archive(archive(version, prefix))
    assert pet["version"] == version
    assert pet["rows"] == (9 if version == 1 else 11)
    assert pet["name"] == "测试角色" and image.startswith(b"\x89PNG")


@pytest.mark.parametrize("extra,metadata", [
    ({"../escape":"x"}, None), ({"/absolute":"x"}, None),
    ({"second/pet.json":"{}"}, None), ({"script.js":"harmless data"}, {"spritesheetPath":"../sprite.png"}),
    (None, {"spriteVersionNumber":1}), (None, {"displayName": {"invalid":True}}),
])
def test_invalid_archive_rejected(extra, metadata):
    with pytest.raises(PetImportError):
        inspect_archive(archive(extra=extra, metadata=metadata))


def test_missing_frames_are_skipped_and_thumbnail_uses_a_visible_frame():
    pet, _image = inspect_archive(archive(bad_frame=True))
    assert pet["frame_map"][0] == [[0, column] for column in range(1, 6)]


@pytest.mark.parametrize("version", [1, 2])
def test_extra_cells_and_missing_actions_are_playable(version):
    pet, _image = inspect_archive(archive(version=version, cells=[(0, column) for column in range(7)]))
    assert len(pet["frame_map"][0]) == 7
    assert pet["frame_map"][0][-1] == [0, 6]
    assert pet["frame_map"][7] == pet["frame_map"][0]
    if version == 2:
        assert pet["frame_map"][9] == [[0, 0]] * 8


def test_first_available_frame_can_supply_missing_idle():
    pet, _image = inspect_archive(archive(cells=[(3, 2)]))
    assert pet["frame_map"][0] == [[3, 2]]
    assert pet["frame_map"][10] == [[3, 2]] * 8


def test_opaque_background_is_accepted_but_invisible_sheet_is_rejected():
    pet, _image = inspect_archive(archive(opaque=True))
    assert all(len(row) == 8 for row in pet["frame_map"])
    with pytest.raises(PetImportError, match="没有可显示"):
        inspect_archive(archive(cells=[]))


def test_store_deduplicates_and_survives_new_instance(tmp_path):
    pet, image = inspect_archive(archive())
    store = PetStore(tmp_path)
    store.save(pet, image)
    store.save(pet, image)
    assert len(store.list()) == 1
    assert PetStore(tmp_path).get(pet["id"]) == pet
    with pytest.raises(PetImportError, match="切换"):
        store.remove(pet["id"], pet["id"])
    with pytest.raises(PetImportError):
        store.directory("../outside")
    store.remove(pet["id"], "kurisu")
    assert store.list() == []


def test_http_preview_save_switch_reload_asset_delete(tmp_path, monkeypatch):
    saved = []
    logs = []
    for level in ["info", "warning", "error"]:
        monkeypatch.setattr(logger, level, lambda message, *args: logs.append(message % args if args else message))
    monkeypatch.setattr(AgentMascot, "get_data_path", lambda self: tmp_path)
    monkeypatch.setattr(AgentMascot, "update_config", lambda self, config: saved.append(dict(config)))
    plugin = object.__new__(AgentMascot)
    plugin.init_plugin({"enabled":True, "mascot":"kurisu"})
    app = FastAPI()
    for route in plugin.get_api():
        app.add_api_route(route["path"], route["endpoint"], methods=route["methods"], response_model=route.get("response_model"))
    with TestClient(app) as client:
        payload = archive(prefix="full/package/", bad_frame=True,
                          extra={"full/tool.py":"raise RuntimeError('must never execute')"})
        preview = client.post("/pets/inspect", files={"file":("pet.zip",payload,"application/zip")}).json()
        assert preview["success"] and preview["data"]["pet"]["sprite_url"].startswith("data:image/png;")
        assert client.get("/pets").json()["data"]["pets"] == []
        imported = client.post("/pets/import", files={"file":("pet.zip",payload,"application/zip")}).json()
        pet = imported["data"]["pet"]
        assert pet["frame_map"][0][0] == [0, 1]
        assert pet["id"] == preview["data"]["pet"]["id"]
        assert len(client.get("/pets").json()["data"]["pets"]) == 1
        assert not (tmp_path / "pets" / pet["id"] / "tool.py").exists()
        assert client.post("/config", json={"mascot":pet["id"]}).json()["success"]
        plugin.init_plugin(saved[-1])
        status = client.get("/status").json()["data"]
        assert status["config"]["mascot"] == pet["id"] and status["pet"]["id"] == pet["id"]
        assert status["pet"]["frame_map"] == pet["frame_map"]
        assert client.get("/public_status").json()["data"]["pet"]["id"] == pet["id"]
        image = client.get(f'/pets/{pet["id"]}/image')
        assert image.status_code == 200 and image.headers["content-type"] == "image/png"
        assert not client.delete(f'/pets/{pet["id"]}').json()["success"]
        assert client.post("/config", json={"mascot":"kurisu"}).json()["success"]
        assert client.delete(f'/pets/{pet["id"]}').json()["success"]
        assert client.get(f'/pets/{pet["id"]}/image').status_code == 404
        assert not client.post("/config", json={"mascot":pet["id"]}).json()["success"]
        assert not client.post("/pets/inspect", files={"file":("broken.zip", b"not a zip")}).json()["success"]
        for expected in ["预览校验成功", "导入或复用成功", "配置保存完成", "移除拒绝", "移除完成", "预览校验失败"]:
            assert any(expected in line for line in logs), expected
        assert not any("data:image" in line or "sprite_url" in line for line in logs)


def test_missing_selected_asset_keeps_settings_recoverable(tmp_path, monkeypatch):
    monkeypatch.setattr(AgentMascot, "get_data_path", lambda self: tmp_path)
    monkeypatch.setattr(AgentMascot, "update_config", lambda self, config: None)
    plugin = object.__new__(AgentMascot)
    missing = "pet_" + "a" * 32
    plugin.init_plugin({"enabled": True, "mascot": missing})
    status = plugin.get_status().model_dump()
    assert status["data"]["config"]["mascot"] == missing
    assert status["data"]["pet"] is None
    assert not plugin.save_config_api({"mascot": missing}).success
    assert plugin.save_config_api({"mascot": "kurisu"}).success


def test_storage_failure_returns_actionable_result(tmp_path, monkeypatch):
    monkeypatch.setattr(AgentMascot, "get_data_path", lambda self: tmp_path)
    monkeypatch.setattr(AgentMascot, "update_config", lambda self, config: None)
    plugin = object.__new__(AgentMascot)
    plugin.init_plugin({"enabled": True, "mascot": "kurisu"})

    def fail(*_args):
        raise OSError("private diagnostic")

    monkeypatch.setattr(plugin._pets, "save", fail)
    upload = UploadFile(io.BytesIO(archive()), filename="pet.zip")
    result = plugin.import_pet(upload)
    assert not result.success and "保存失败" in result.message
    assert "private diagnostic" not in result.message and upload.file.closed
    monkeypatch.setattr(plugin._pets, "remove", fail)
    result = plugin.delete_pet("pet_" + "a" * 32)
    assert not result.success and "移除失败" in result.message
