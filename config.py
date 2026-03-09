"""Centralized configuration for Claude Orchestrator V2."""

import os
import yaml
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_INTERACTIVE_RULES = {
    # create-next-app prompts
    "Would you like to use TypeScript": "Yes",
    "Would you like to use ESLint": "Yes",
    "Would you like to use Tailwind CSS": "Yes",
    "Would you like to use `src/` directory": "Yes",
    "Would you like to use App Router": "Yes",
    "Would you like to use Turbopack": "No",
    "Would you like to customize the import alias": "No",
    # create-nextspark-app / nextspark init prompts
    "Select a preset": "saas",
    "Select a theme": "default",
    "Select project type": "web",
    "Select team mode": "multi-tenant",
    "Select billing model": "freemium",
    "Enter project name": "",
    "Enter project slug": "",
    "Enter project description": "",
    "Initialize git repository": "y",
    "Select features": "",
    "Select locales": "",
    "Select auth providers": "",
    # pnpm prompts
    "Packages: +": "y",
    # Generic prompts
    "package manager": "pnpm",
    "Ok to proceed": "y",
    "Need to install the following packages": "y",
    "Is this OK": "y",
    "(y/N)": "y",
    "(Y/n)": "y",
    "Press Enter to continue": "",
    "press ENTER": "",
    "Overwrite": "y",
    "Continue?": "y",
    "Proceed": "y",
}


@dataclass
class OrchestratorConfig:
    # Timeouts (seconds)
    turn_timeout: int = 600
    phase_timeout: int = 7200
    total_timeout: int = 86400
    health_check_interval: int = 30
    jsonl_appear_timeout: int = 120
    initial_settle_time: int = 5
    server_start_timeout: int = 60

    # Review thresholds
    min_task_score: int = 7
    min_final_score: int = 8
    max_review_cycles: int = 3
    max_task_retries: int = 2

    # Browser validation
    enable_browser_validation: bool = True
    dev_server_port: int = 3000
    dev_server_start_cmd: str = "npm run dev"
    dev_server_url: str = "http://localhost:3000"
    browser_headless: bool = True
    screenshot_dir: str = ".orchestrator/screenshots"

    # Dashboard
    enable_dashboard: bool = True
    dashboard_port: int = 8080

    # Interactive prompt handling
    interactive_rules: dict = field(default_factory=lambda: dict(DEFAULT_INTERACTIVE_RULES))

    # Recovery
    checkpoint_dir: str = ".orchestrator"
    auto_resume: bool = True

    # Context restoration
    max_context_files: int = 10
    context_file_max_lines: int = 50

    @classmethod
    def load(cls, path: str | None = None) -> "OrchestratorConfig":
        """Load config from YAML file, falling back to defaults."""
        config = cls()
        if path and os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                for key, value in data.items():
                    if hasattr(config, key):
                        setattr(config, key, value)
                logger.info("Loaded config from %s", path)
            except Exception as e:
                logger.warning("Failed to load config from %s: %s", path, e)
        return config

    def checkpoint_path(self, cwd: str) -> Path:
        return Path(cwd) / self.checkpoint_dir / "checkpoint.json"

    def screenshots_path(self, cwd: str) -> Path:
        p = Path(cwd) / self.screenshot_dir
        p.mkdir(parents=True, exist_ok=True)
        return p
