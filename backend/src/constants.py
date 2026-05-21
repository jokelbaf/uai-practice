from utils import get_env

IS_PROD = get_env("IS_PROD", required=False) in ["true", "1", "yes"]
"""Whether the app is running in production mode."""
