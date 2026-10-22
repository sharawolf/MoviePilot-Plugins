"""智序港城入园预约助手插件。"""

import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.log import logger
from app.plugins import _PluginBase
from app.schemas.types import MessageType
from app.sdk.network import RequestUtils


class EportcityAssistant(_PluginBase):
    """智序港城入园预约助手：监测登录凭证有效期并自动审批待审核预约。"""

    plugin_name = "智序港城助手"
    plugin_desc = "定时检测智序港城登录状态，自动审批本企业待审核的入园预约，并记录登录凭证的有效期。"
    plugin_icon = "eportcity.png"
    plugin_version = "1.0.3"
    plugin_label = "工具"
    plugin_author = "sharawolf"
    author_url = "https://github.com/sharawolf"
    plugin_config_prefix = "eportcityassistant_"
    plugin_order = 50
    auth_level = 1

    _API_BASE = "https://www.eportcity.com"
    _USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    )
    _STATE_KEY = "state"
    _HISTORY_KEY = "history"
    _HISTORY_LIMIT = 50
    _TIME_FORMAT = "%Y-%m-%d %H:%M:%S"

    _enabled = False
    _notify = True
    _auto_approve = True
    _dry_run = False
    _cookie = ""
    _auth_token = ""
    _interval = 10
    _days_ahead = 3
    _remarks = "审核通过"

    def init_plugin(self, config: dict = None) -> None:
        """根据插件配置初始化运行状态。"""
        self.stop_service()
        self._sync_plugin_icon()
        config = config or {}
        self._enabled = bool(config.get("enabled"))
        self._notify = bool(config.get("notify", True))
        self._auto_approve = bool(config.get("auto_approve", True))
        self._dry_run = bool(config.get("dry_run", False))
        self._cookie = str(config.get("cookie") or "").strip()
        self._auth_token = str(config.get("auth_token") or "").strip()
        self._remarks = str(config.get("remarks") or "审核通过").strip()
        self._interval = self._safe_int(config.get("interval"), 10, 1)
        self._days_ahead = self._safe_int(config.get("days_ahead"), 3, 1)
        if self._enabled and not self._auth_token:
            logger.warn("智序港城助手：插件已启用，但未配置 X-Auth-Token")

    @staticmethod
    def _sync_plugin_icon() -> None:
        """把插件自带图标同步到前端静态目录，供插件卡片展示。"""
        try:
            source = Path(__file__).with_name("eportcity.png")
            target = Path("/public/plugin_icon/eportcity.png")
            if not source.exists():
                return
            if target.exists() and target.stat().st_size == source.stat().st_size:
                return
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            logger.info("智序港城助手：插件图标已同步到前端静态目录")
        except Exception as err:  # noqa: BLE001
            logger.debug(f"智序港城助手：同步插件图标失败：{err}")

    @staticmethod
    def _safe_int(value: Any, default: int, minimum: int) -> int:
        """把配置值转换为不小于下限的整数。"""
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError):
            return default
        return max(minimum, parsed)

    def get_state(self) -> bool:
        """获取插件启用状态。"""
        return self._enabled

    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        """返回插件远程命令列表。"""
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        """本插件不注册手动触发的 HTTP 接口，执行入口只有定时服务。"""
        return []

    def get_service(self) -> List[Dict[str, Any]]:
        """注册定时检测与自动审批服务。"""
        if not self._enabled or not self._auth_token:
            return []
        return [
            {
                "id": "EportcityAssistant",
                "name": "智序港城入园预约检查",
                "trigger": "interval",
                "func": self.run_check,
                "kwargs": {"minutes": self._interval},
            }
        ]

    def stop_service(self) -> None:
        """停止插件后台服务。"""
        return None

    def run_check(self, manual: bool = False) -> Dict[str, Any]:
        """执行一次登录检测与待审批预约处理。"""
        if not self._enabled and not manual:
            return {"success": False, "message": "插件未启用"}
        if not self._auth_token:
            return {"success": False, "message": "未配置 X-Auth-Token"}
        now = datetime.now()
        state = self.get_data(self._STATE_KEY) or {}
        profile, error = self._check_login()
        if error:
            return self._handle_login_lost(state, now, error)
        return self._handle_login_ok(state, now, profile)

    def _check_login(self) -> Tuple[Optional[dict], str]:
        """调用用户信息接口验证当前登录凭证是否有效。"""
        data, error = self._api("GET", "/api/user/auth/getInfo")
        if error:
            return None, error
        result = data.get("result") or {}
        user = result.get("user") or {}
        company = result.get("company") or {}
        if not user:
            return None, "登录凭证无效：未返回用户信息"
        return {"user": user, "company": company}, ""

    def _handle_login_lost(self, state: dict, now: datetime, error: str) -> Dict[str, Any]:
        """记录登录失效时间、有效期并发送一次性通知。"""
        now_text = now.strftime(self._TIME_FORMAT)
        first_ok = state.get("first_ok")
        expired_at = state.get("expired_at") or now_text
        duration_hours = state.get("duration_hours")
        if first_ok and not state.get("expired_at"):
            started = self._parse_time(first_ok)
            if started:
                duration_hours = round((now - started).total_seconds() / 3600, 1)
        state.update(
            {
                "login_ok": False,
                "last_check": now_text,
                "last_error": error,
                "expired_at": expired_at,
                "duration_hours": duration_hours,
            }
        )
        self.save_data(self._STATE_KEY, state)
        logger.warn(f"智序港城助手：登录凭证检测失败 - {error}")
        if self._notify and not state.get("expired_notified"):
            duration_text = self._duration_text(first_ok, expired_at)
            self.post_message(
                mtype=MessageType.Plugin,
                title="【智序港城助手】登录已失效",
                text=(
                    f"检测结果：{error}\n"
                    f"凭证自 {first_ok or '未知'} 起共维持：{duration_text}\n"
                    "请更新 Cookie 与 X-Auth-Token 后重新启用插件。"
                ),
            )
            state["expired_notified"] = True
            self.save_data(self._STATE_KEY, state)
        return {"success": False, "message": f"登录已失效：{error}"}

    def _handle_login_ok(self, state: dict, now: datetime, profile: dict) -> Dict[str, Any]:
        """登录有效时更新状态、查询待审批预约并执行审批。"""
        now_text = now.strftime(self._TIME_FORMAT)
        user = profile.get("user") or {}
        company = profile.get("company") or {}
        company_id = user.get("companyId") or company.get("shopId")
        company_name = user.get("companyName") or company.get("companyCname") or ""
        mobile = user.get("mobile") or company.get("companyMobile") or ""
        login_time = user.get("lastLoginTime") or ""

        first_ok = state.get("first_ok") or ""
        expired_at = state.get("expired_at")
        if login_time and (not first_ok or login_time > first_ok):
            first_ok = login_time
            expired_at = None
        if not first_ok:
            first_ok = now_text
        started = self._parse_time(first_ok)
        duration_hours = round((now - started).total_seconds() / 3600, 1) if started else None

        pending, fetch_error = self._fetch_pending(company_id)
        approved_count = 0
        failed_count = 0
        if fetch_error:
            logger.warn(f"智序港城助手：待审批预约查询失败 - {fetch_error}")
        elif pending:
            logger.info(f"智序港城助手：发现 {len(pending)} 条待审核入园预约")
            if self._auto_approve and not self._dry_run:
                for record in pending:
                    success, message = self._approve(record, company_id, company_name, mobile)
                    self._append_history(record, success, message, now_text)
                    if success:
                        approved_count += 1
                    else:
                        failed_count += 1
                if self._notify and (approved_count or failed_count):
                    self._notify_approval(pending, approved_count, failed_count)

        state.update(
            {
                "login_ok": True,
                "last_check": now_text,
                "last_ok": now_text,
                "last_error": "",
                "first_ok": first_ok,
                "expired_at": expired_at,
                "duration_hours": duration_hours,
                "user_name": company_name,
                "company_id": company_id,
                "pending_count": len(pending),
                "approved_total": int(state.get("approved_total") or 0) + approved_count,
            }
        )
        if not expired_at:
            state["expired_notified"] = False
        self.save_data(self._STATE_KEY, state)
        if self._dry_run and pending:
            logger.info("智序港城助手：试运行模式，仅记录待审批预约，未提交审批")
        return {
            "success": True,
            "message": (
                f"登录有效，待审批 {len(pending)} 条，已通过 {approved_count} 条"
                if not fetch_error
                else f"登录有效，但查询待审批失败：{fetch_error}"
            ),
        }

    def _fetch_pending(self, company_id: Any) -> Tuple[List[dict], str]:
        """查询指定企业未来若干天内待审核的入园预约。"""
        now = datetime.now()
        payload = {
            "pageNum": 1,
            "pageSize": 50,
            "deptId": company_id,
            "status": "01",
            "inParkTimeStart": now.strftime("%Y-%m-%d 00:00:00"),
            "inParkTimeEnd": (now + timedelta(days=self._days_ahead)).strftime("%Y-%m-%d 23:59:59"),
        }
        data, error = self._api("POST", "/api/easypark/gardenPark/findGardenPark", payload)
        if error:
            return [], error
        result = data.get("result") or {}
        records = result.get("data") or []
        return [item for item in records if str(item.get("status")) == "01"], ""

    def _approve(self, record: dict, company_id: Any, company_name: str, mobile: str) -> Tuple[bool, str]:
        """提交单条入园预约的审核通过操作。"""
        payload = {
            "id": record.get("id"),
            "planNumber": record.get("planNumber"),
            "status": "02",
            "remarks": self._remarks or "审核通过",
            "deptId": record.get("deptId") or company_id,
            "rsv1": mobile,
            "rsv2": company_name,
        }
        data, error = self._api("POST", "/api/easypark/gardenPark/updateGardenPark", payload)
        if error:
            logger.error(f"智序港城助手：预约 {record.get('id')} 审批失败 - {error}")
            return False, error
        logger.info(f"智序港城助手：预约 {record.get('id')} 审批通过")
        return True, "审核通过"

    def _append_history(self, record: dict, success: bool, message: str, now_text: str) -> None:
        """把单条审批结果追加到最近记录。"""
        history = self.get_data(self._HISTORY_KEY) or []
        history.insert(
            0,
            {
                "time": now_text,
                "id": record.get("id"),
                "driver": record.get("driverName") or "",
                "plate": record.get("licensePlate") or "",
                "inParkTime": record.get("inParkTime") or "",
                "success": success,
                "message": message,
            },
        )
        self.save_data(self._HISTORY_KEY, history[: self._HISTORY_LIMIT])

    def _notify_approval(self, pending: List[dict], approved: int, failed: int) -> None:
        """发送审批结果通知。"""
        lines = [f"发现待审核入园预约 {len(pending)} 条，通过 {approved} 条，失败 {failed} 条。"]
        for item in pending[:5]:
            lines.append(
                f"- {item.get('driverName') or '未知司机'} / {item.get('licensePlate') or '无车牌'} / "
                f"{item.get('inParkTime') or '未填时间'}"
            )
        self.post_message(
            mtype=MessageType.Plugin,
            title="【智序港城助手】入园预约审批结果",
            text="\n".join(lines),
        )

    def _api(self, method: str, path: str, payload: Optional[dict] = None) -> Tuple[Optional[dict], str]:
        """调用智序港城接口并返回解析后的 JSON 或错误说明。"""
        if not self._auth_token:
            return None, "未配置 X-Auth-Token"
        headers = {
            "X-Auth-Token": self._auth_token,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=utf-8",
            "Origin": self._API_BASE,
            "Referer": f"{self._API_BASE}/",
            "User-Agent": self._USER_AGENT,
        }
        request = RequestUtils(headers=headers, cookies=self._cookie or None, timeout=20)
        url = f"{self._API_BASE}{path}"
        try:
            response = request.request(method=method.lower(), url=url, json=payload)
        except Exception as err:
            return None, f"请求异常：{err}"
        if response is None:
            return None, "请求失败：无响应"
        if response.status_code != 200:
            return None, f"请求失败：HTTP {response.status_code}"
        try:
            data = response.json()
        except Exception:
            return None, "请求失败：响应不是合法 JSON"
        code = str(data.get("code") or "")
        if code not in ("0000", "0", "200"):
            message = data.get("message") or data.get("msg") or ""
            return None, f"接口返回 {code}：{message}".strip()
        return data, ""

    @classmethod
    def _parse_time(cls, value: Optional[str]) -> Optional[datetime]:
        """把平台返回的时间字符串解析为本地时间。"""
        if not value:
            return None
        try:
            return datetime.strptime(str(value), cls._TIME_FORMAT)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _duration_text(cls, start: Optional[str], end: Optional[str]) -> str:
        """把起止时间转换为天和小时的易读描述。"""
        started = cls._parse_time(start)
        ended = cls._parse_time(end)
        if not started or not ended:
            return "未知"
        hours = max(0.0, (ended - started).total_seconds() / 3600)
        days = int(hours // 24)
        rest = round(hours % 24, 1)
        return f"{days} 天 {rest} 小时" if days else f"{rest} 小时"

    def get_form(self) -> Tuple[Optional[List[dict]], Dict[str, Any]]:
        """返回插件配置表单与默认配置。"""
        return [
            {
                "component": "VForm",
                "content": [
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 3},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {"model": "enabled", "label": "启用插件"},
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 3},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {"model": "notify", "label": "发送通知"},
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 3},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {"model": "auto_approve", "label": "自动审批通过"},
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 3},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "model": "dry_run",
                                            "label": "试运行",
                                            "hint": "只查询并记录待审批预约，不提交审批",
                                            "persistent-hint": True,
                                        },
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 6},
                                "content": [
                                    {
                                        "component": "VTextField",
                                        "props": {
                                            "model": "interval",
                                            "label": "检查间隔（分钟）",
                                            "type": "number",
                                            "hint": "建议 5-30 分钟，过于频繁可能触发平台风控",
                                            "persistent-hint": True,
                                        },
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 6},
                                "content": [
                                    {
                                        "component": "VTextField",
                                        "props": {
                                            "model": "days_ahead",
                                            "label": "查询未来天数",
                                            "type": "number",
                                            "hint": "从今天起查询多少天内待审核的入园预约",
                                            "persistent-hint": True,
                                        },
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12},
                                "content": [
                                    {
                                        "component": "VTextarea",
                                        "props": {
                                            "model": "cookie",
                                            "label": "Cookie",
                                            "rows": 2,
                                            "hint": "浏览器登录后复制的完整 Cookie，例如 eportcity-sid=...; SmartOrderWebToken=...; LoginStatusToken=...",
                                            "persistent-hint": True,
                                        },
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 8},
                                "content": [
                                    {
                                        "component": "VTextField",
                                        "props": {
                                            "model": "auth_token",
                                            "label": "X-Auth-Token",
                                            "hint": "浏览器请求头中的 X-Auth-Token，通常与 SmartOrderWebToken 的值相同",
                                            "persistent-hint": True,
                                        },
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VTextField",
                                        "props": {
                                            "model": "remarks",
                                            "label": "审批备注",
                                            "placeholder": "审核通过",
                                        },
                                    }
                                ],
                            },
                        ],
                    },
                ],
            }
        ], {
            "enabled": False,
            "notify": True,
            "auto_approve": True,
            "dry_run": False,
            "interval": 10,
            "days_ahead": 3,
            "cookie": "",
            "auth_token": "",
            "remarks": "审核通过",
        }

    def get_page(self) -> Optional[List[dict]]:
        """返回插件详情页，展示登录状态、有效期与最近审批记录。"""
        if not self._enabled:
            return [
                {
                    "component": "VAlert",
                    "props": {"type": "info", "variant": "tonal", "text": "插件未启用，启用后开始记录登录凭证有效期。"},
                }
            ]
        state = self.get_data(self._STATE_KEY) or {}
        history = self.get_data(self._HISTORY_KEY) or []
        login_ok = state.get("login_ok")
        if login_ok is True:
            alert_type = "success"
            alert_text = f"登录有效：{state.get('user_name') or '未知企业'}"
        elif login_ok is False:
            alert_type = "error"
            alert_text = f"登录已失效：{state.get('last_error') or '凭证无效'}"
        else:
            alert_type = "warning"
            alert_text = "尚未完成首次检测，请点击“立即检查”。"

        first_ok = state.get("first_ok")
        if login_ok is True:
            started = self._parse_time(first_ok)
            duration = (
                f"{round((datetime.now() - started).total_seconds() / 3600, 1)} 小时" if started else "未知"
            )
        else:
            duration = self._duration_text(first_ok, state.get("expired_at"))

        metrics = [
            ("登录起始", first_ok or "未知"),
            ("已持续", duration),
            ("上次检查", state.get("last_check") or "从未"),
            ("待审批", str(state.get("pending_count") or 0)),
            ("累计审批通过", str(state.get("approved_total") or 0)),
        ]
        cards = []
        for label, value in metrics:
            cards.append(
                {
                    "component": "VCol",
                    "props": {"cols": 12, "sm": 6, "md": 4},
                    "content": [
                        {
                            "component": "VCard",
                            "props": {"variant": "tonal"},
                            "content": [
                                {
                                    "component": "VCardText",
                                    "content": [
                                        {"component": "div", "props": {"class": "text-caption"}, "text": label},
                                        {"component": "div", "props": {"class": "text-h6"}, "text": value},
                                    ],
                                }
                            ],
                        }
                    ],
                }
            )

        content: List[dict] = [
            {"component": "VAlert", "props": {"type": alert_type, "variant": "tonal", "text": alert_text}},
            {"component": "VRow", "props": {"class": "mt-2"}, "content": cards},
            {
                "component": "div",
                "props": {"class": "mt-4 text-caption text-medium-emphasis"},
                "text": f"由定时服务每 {self._interval} 分钟自动执行；需要立即执行时，请在「设置 → 定时任务」中手动运行「智序港城入园预约检查」。",
            },
        ]

        if history:
            headers = ["时间", "司机", "车牌", "入园时间", "结果"]
            header_cells = [
                {"component": "th", "props": {"class": "text-start"}, "text": header}
                for header in headers
            ]
            rows = []
            for item in history[:20]:
                rows.append(
                    {
                        "component": "tr",
                        "content": [
                            {"component": "td", "text": str(item.get("time") or "")},
                            {"component": "td", "text": str(item.get("driver") or "")},
                            {"component": "td", "text": str(item.get("plate") or "")},
                            {"component": "td", "text": str(item.get("inParkTime") or "")},
                            {"component": "td", "text": str(item.get("message") or "")},
                        ],
                    }
                )
            content.append(
                {
                    "component": "VTable",
                    "props": {"hover": True, "density": "compact", "class": "mt-4"},
                    "content": [
                        {"component": "thead", "content": [{"component": "tr", "content": header_cells}]},
                        {"component": "tbody", "content": rows},
                    ],
                }
            )
        else:
            content.append(
                {
                    "component": "VAlert",
                    "props": {"type": "info", "variant": "tonal", "class": "mt-4", "text": "暂无审批记录。"},
                }
            )
        return content
