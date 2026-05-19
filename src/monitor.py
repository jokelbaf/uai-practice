import enum


class AlertLevel(enum.IntEnum):
    """Enum for alert levels."""

    OK = 0
    WARNING = 1
    ERROR = 2
    CRITICAL = 3
