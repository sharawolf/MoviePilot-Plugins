# Agent 桌宠形象

v1.0.0 — 适配 MoviePilot V3 接口，恢复桌宠入口，保留原有角色与动作。

本地适配候选，支持 MoviePilot v3.1.3 及以上。原作者：ifsherlock；本次 V3 维护：z2561221。

在插件配置中启用插件、选择“克里斯蒂娜”，并打开“替换智能助手入口”。打开侧栏“Agent 桌宠”或插件详情页后，桌宠会在当前页面会话中接替原生助手入口；单击桌宠打开原生智能助手，拖拽不会误触发对话。

切换 MP 页面后桌宠继续运行。整页刷新后需要再次打开桌宠页面；当前官方宿主没有自动执行全局插件脚本的入口，本插件不修改宿主前端、不注入全局配置。已有的独立脚本加载方式仍可使用受认证的 `/api/v1/plugin/AgentMascot/loader` 接口。停用插件后，已打开页面在下一次状态检查时恢复原生入口。

保留小天照、奶龙、克里斯蒂娜的素材和 idle / walk / run / follow / drag / sleep / wall / ceiling / fall 动作。JSON API 明确返回 `success / message / data`，插件界面复用宿主注入的 API 客户端。

恢复来源：`agentmascot_v0.1.18-behavior-actions-slim.zip`，SHA-256：`019cbc33013486db096d31547738cf948bdeaad7798734977b79cdcdb2c11686`。原包源码版本为 0.1.15、前端包版本为 0.1.16；首次 V3 迁移统一为 1.0.0。原包只包含编译后的前端模块，本次直接维护这些可读模块，未声称重新执行缺失源码的 Vite 构建。角色运行时与素材保持原字节。

验证入口：`tests/v3/agentmascot/test_plugin.py` 与 `tests/v3/agentmascot/test_runtime.mjs`。本轮本地安装不代表浏览器视觉验收或线上发布。
