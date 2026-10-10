"""Small, non-sensitive summaries routed through the host plugin logger."""

from app.sdk.logging import logger


def log_configuration(plugin, event: str, previous: dict | None = None) -> None:
    config = plugin._current_config()
    fields = {key: value for key, value in config.items()
              if previous is None or previous.get(key) != value}
    if not fields:
        return
    logger.info("%s: instance=%s version=%s %s", event, plugin.__class__.__name__,
                plugin.plugin_version, " ".join(f"{key}={value}" for key, value in fields.items()))
