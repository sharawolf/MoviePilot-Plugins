"""V3 payload, configuration preservation and lifecycle regression checks."""

import json
import math
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.plugins.agentmascot import AgentMascot
from app.plugins.agentmascot.config import normalize_config
from app.plugins.agentmascot.models import StatusResponse
from app.sdk.logging import logger


@pytest.fixture
def plugin(monkeypatch, tmp_path):
    saved = []
    monkeypatch.setattr(AgentMascot, "update_config", lambda self, config: saved.append(dict(config)))
    monkeypatch.setattr(AgentMascot, "get_data_path", lambda self: tmp_path)
    # The mascot uses no host chain; isolate those startup-only services here.
    # Actual base construction is covered by the target host install/reload.
    instance = object.__new__(AgentMascot)
    instance.init_plugin({"enabled": True, "mascot": "kurisu", "scale": 1.4})
    instance.saved_configs = saved
    return instance


@pytest.fixture
def client(plugin):
    app = FastAPI()
    for route in plugin.get_api():
        app.add_api_route(route["path"], route["endpoint"], methods=route["methods"],
                          response_model=route.get("response_model"))
    with TestClient(app) as result:
        yield result


@pytest.mark.parametrize("path", ["/status", "/public_status"])
def test_typed_http_payload(client, path):
    response = client.get(path)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"success", "message", "data"}
    assert body["success"] is True
    assert body["data"]["config"]["mascot"] == "kurisu"
    assert body["data"]["summary"]["enabled"] is True


def test_partial_save_preserves_existing_fields(client, plugin):
    body = client.post("/config", json={"speed": 1.6}).json()
    assert body["success"] is True
    assert body["data"]["config"]["mascot"] == "kurisu"
    assert body["data"]["config"]["enabled"] is True
    assert body["data"]["config"]["scale"] == 1.4
    assert plugin.saved_configs[-1]["speed"] == 1.6


def test_save_failure_restores_runtime_config(plugin, monkeypatch):
    before = plugin._current_config()
    def fail():
        raise OSError("private diagnostic")
    monkeypatch.setattr(plugin, "_save_config", fail)
    response = plugin.save_config_api({"mascot": "nailong"})
    assert isinstance(response, StatusResponse)
    assert response.success is False
    assert response.data is None
    assert "private diagnostic" not in response.message
    assert plugin._current_config() == before


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf, "invalid"])
def test_nonfinite_configuration_remains_json_safe(value):
    config = normalize_config({"scale": value, "speed": value})
    assert config["scale"] == config["speed"] == 1.0
    json.dumps(config, allow_nan=False)


def test_repeat_init_stop_and_disable(plugin):
    plugin.stop_service()
    plugin.stop_service()
    plugin.init_plugin({"enabled": False, "mascot": "kurisu"})
    assert plugin.get_state() is False
    assert plugin.get_sidebar_nav() == []
    plugin.init_plugin({"enabled": True, "mascot": "kurisu"})
    assert len(plugin.get_sidebar_nav()) == 1
    assert len({route["path"] for route in plugin.get_api()}) == 9


def test_classic_loader_is_self_contained(client):
    import subprocess
    response = client.get("/loader")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "application/javascript" in response.headers["content-type"]
    code = response.text
    assert not any(line.startswith(("import ", "export ")) for line in code.splitlines())
    assert "startAgentMascotPatchEntry();" in code
    assert "createCodexPetRuntime" in code
    assert "localStorage" not in code
    result = subprocess.run(["node", "--check"], input=code, encoding="utf-8",
                            capture_output=True, check=False)
    assert result.returncode == 0, result.stderr


def test_missing_loader_returns_native_error(client, plugin, tmp_path):
    plugin._api._plugin_root = tmp_path
    response = client.get("/loader")
    assert response.status_code == 500
    assert "AgentMascot loader failed" in response.text
    assert str(tmp_path) not in response.text


def test_lifecycle_config_and_missing_asset_logs_do_not_flood_on_polling(plugin, monkeypatch):
    messages = []
    for level in ["info", "warning", "error"]:
        monkeypatch.setattr(logger, level, lambda message, *args: messages.append(message % args if args else message))
    plugin.init_plugin({"enabled": True, "mascot": "kurisu", "follow_mouse": True})
    assert any("桌宠初始化完成" in text and "follow_mouse=True" in text for text in messages)
    plugin.save_config_api({"speed": 1.8})
    assert any("桌宠配置保存完成" in text and "speed=1.8" in text for text in messages)
    count = len(messages)
    plugin.get_status(); plugin.get_public_status(); plugin.list_pets()
    plugin.save_config_api({"speed": 1.8})
    assert len(messages) == count
    plugin.stop_service(); plugin.stop_service()
    assert sum("桌宠后端停止" in text for text in messages) == 1
    plugin.init_plugin({"enabled": True, "mascot": "pet_" + "a" * 32})
    for _ in range(4):
        plugin.get_public_status()
    assert sum("所选桌宠资源缺失" in text for text in messages) == 1
    assert not any("data:image" in text or "sprite_url" in text for text in messages)


def test_configuration_persistence_failure_emits_error_without_success(plugin, monkeypatch):
    errors, successes = [], []
    monkeypatch.setattr(logger, "error", lambda message, *args: errors.append(message))
    monkeypatch.setattr(logger, "info", lambda message, *args: successes.append(message))
    def fail():
        raise OSError("storage unavailable")
    monkeypatch.setattr(plugin, "_save_config", fail)
    before = plugin._current_config()
    assert not plugin.save_config_api({"speed": 1.9}).success
    assert plugin._current_config() == before
    assert errors and not successes
    with pytest.raises(OSError):
        plugin.init_plugin(before)
    assert any("初始化失败" in text for text in errors)


def test_original_asset_survives_and_metadata_agrees():
    import hashlib
    import app.plugins.agentmascot as module
    root = Path(module.__file__).parent
    metadata = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    assert metadata["version"] == module.AgentMascot.plugin_version == "1.0.0"
    runtime = root / "dist/assets/runtime-BCybTabx.js"
    assert hashlib.sha256(runtime.read_bytes()).hexdigest() == "a8b13331388311919324a132c5df318e6a9bc00304089ba082b17d7836f90a5c"
    assert "v1.0.0" in metadata["history"]
