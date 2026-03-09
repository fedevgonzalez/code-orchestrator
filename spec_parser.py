"""Spec Parser — Generate tasks.json from a product specification.

Uses Claude Code CLI in pipe mode (claude -p) to analyze a product spec
and generate a structured list of development tasks with dependencies.
"""

import json
import logging
import os
from pathlib import Path

from reviewer import _call_claude_pipe

logger = logging.getLogger(__name__)


GENERATE_TASKS_PROMPT = """You are an expert software architect. Given a product specification, generate a complete list of development tasks that will build this product from scratch.

PRODUCT SPECIFICATION:
{spec}

RULES:
1. Break down the project into 15-40 granular tasks
2. Each task should be completable in a single Claude Code session turn (5-15 minutes)
3. Order tasks logically: setup → core infrastructure → features → tests → polish
4. Use depends_on to create a proper dependency chain
5. Each task prompt must be VERY detailed and specific — include file names, function signatures, exact requirements
6. Include validation for every task (check file existence or run tests)
7. Group related work: don't split a single feature across too many tasks
8. Include tasks for: project setup, database schema, API routes, frontend pages, authentication, tests, deployment config

TASK CATEGORIES (use this order):
1. Project initialization (scaffolding, dependencies)
2. Database / ORM setup
3. Authentication & authorization
4. Core business logic / API
5. Frontend pages / components
6. Integration between frontend and backend
7. Tests (unit, integration, e2e)
8. Deployment configuration (Dockerfile, CI/CD, env vars)
9. Documentation

Respond with ONLY valid JSON (no markdown fences, no explanation):
{{
  "project": "project-name",
  "cwd": "./project-dir",
  "tasks": [
    {{
      "id": "unique-id",
      "prompt": "Very detailed prompt for Claude Code...",
      "depends_on": "previous-task-id or null",
      "validate": "check file: file1, file2 OR run: npm test"
    }}
  ]
}}"""


def generate_tasks_from_spec(
    spec_path: str,
    project_cwd: str,
    output_path: str | None = None,
) -> dict:
    """Read a spec file and generate tasks.json via Claude.

    Args:
        spec_path: Path to the .md spec file
        project_cwd: Where the project will be built
        output_path: Where to save tasks.json (default: project_cwd/tasks.json)

    Returns:
        The generated tasks dict
    """
    spec_text = Path(spec_path).read_text(encoding="utf-8")

    prompt = GENERATE_TASKS_PROMPT.format(spec=spec_text)

    logger.info("Generating tasks from spec: %s", spec_path)
    logger.info("This may take a minute...")

    raw = _call_claude_pipe(prompt, project_cwd)

    # Parse the response
    json_str = raw
    if "```json" in raw:
        start = raw.index("```json") + 7
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "```" in raw:
        start = raw.index("```") + 3
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "{" in raw:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        json_str = raw[start:end]

    try:
        tasks_data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse generated tasks: %s", e)
        logger.error("Raw response: %s", raw[:1000])
        raise ValueError(f"Claude did not return valid JSON for tasks: {e}")

    # Ensure cwd is set
    tasks_data["cwd"] = project_cwd

    # Validate structure
    if "tasks" not in tasks_data or not tasks_data["tasks"]:
        raise ValueError("Generated tasks list is empty")

    task_ids = {t["id"] for t in tasks_data["tasks"]}
    for t in tasks_data["tasks"]:
        dep = t.get("depends_on")
        if dep and dep not in task_ids:
            logger.warning(
                "Task '%s' depends on '%s' which doesn't exist, removing dependency",
                t["id"],
                dep,
            )
            t["depends_on"] = None

    # Save
    if output_path is None:
        output_path = os.path.join(project_cwd, "tasks.json")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(tasks_data, f, indent=2, ensure_ascii=False)

    logger.info(
        "Generated %d tasks -> %s", len(tasks_data["tasks"]), output_path
    )

    return tasks_data


def load_spec_summary(spec_path: str, max_chars: int = 2000) -> str:
    """Load a spec file and return a summary (truncated if too long)."""
    text = Path(spec_path).read_text(encoding="utf-8")
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[... spec truncated ...]"
