"""Serve the standalone classic-script build, including imported-pet support."""

import json
from pathlib import Path

from app.sdk.logging import logger
from fastapi.responses import Response

JAVASCRIPT_MEDIA_TYPE = "application/javascript; charset=utf-8"


def build_loader_code(plugin_root: Path) -> str:
    return (plugin_root / "dist/assets/agentmascot-loader.global.js").read_text(encoding="utf-8")


def build_loader_response(plugin_root: Path) -> Response:
    try:
        return Response(content=build_loader_code(plugin_root), media_type=JAVASCRIPT_MEDIA_TYPE,
                        headers={"Cache-Control": "no-store"})
    except OSError:
        logger.exception("获取 Agent 桌宠全局入口脚本失败")
        return Response(content=f"console.error({json.dumps('AgentMascot loader failed')});",
                        media_type=JAVASCRIPT_MEDIA_TYPE, status_code=500)
