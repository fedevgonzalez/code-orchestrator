"""Generate granular tasks for each phase via Claude."""

import json
import logging

from models import Phase, Task
from reviewer import _call_claude_pipe

logger = logging.getLogger(__name__)

GENERATE_PHASE_TASKS_PROMPT = """You are a senior software architect. Generate development tasks for ONE specific phase of a project.

PROJECT SPEC (summary):
{spec_summary}

SPEC ANALYSIS:
{analysis_json}

PHASE: {phase_name} ({phase_id})
PHASE DESCRIPTION: {phase_description}

PREVIOUSLY COMPLETED PHASES: {completed_phases}

RULES:
1. Generate 3-8 tasks for THIS phase only
2. Each task must be completable in one Claude Code turn (5-15 minutes of work)
3. Task prompts must be VERY specific: include file paths, function names, exact requirements
4. Include validation for every task:
   - "check file: path1, path2" for file creation tasks
   - "run: npm test" or "run: npm run build" for code quality tasks
   - "server: npm run dev | http://localhost:3000 | 30" for server tasks
5. Tasks within this phase should have depends_on chains where appropriate
6. Reference specific files and patterns from the tech stack

Respond with ONLY JSON (no markdown):
[
  {{
    "id": "{phase_id}-1",
    "prompt": "Detailed prompt for Claude Code...",
    "depends_on": null,
    "validate": "check file: path/to/file.ts"
  }},
  {{
    "id": "{phase_id}-2",
    "prompt": "Next task...",
    "depends_on": "{phase_id}-1",
    "validate": "run: npm run build"
  }}
]"""


def generate_tasks_for_phase(
    phase: Phase,
    spec_summary: str,
    analysis: dict,
    completed_phases: list[str],
    cwd: str,
) -> list[Task]:
    """Generate tasks for a specific phase using AI."""
    completed_str = ", ".join(completed_phases) if completed_phases else "None (this is the first phase)"

    prompt = GENERATE_PHASE_TASKS_PROMPT.format(
        spec_summary=spec_summary[:3000],
        analysis_json=json.dumps(analysis, indent=2)[:2000],
        phase_name=phase.name,
        phase_id=phase.id,
        phase_description=_get_phase_description(phase.id),
        completed_phases=completed_str,
    )

    logger.info("Generating tasks for phase '%s'...", phase.id)
    raw = _call_claude_pipe(prompt, cwd)

    # Parse JSON
    json_str = raw
    if "```json" in raw:
        start = raw.index("```json") + 7
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "```" in raw:
        start = raw.index("```") + 3
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "[" in raw:
        start = raw.index("[")
        end = raw.rindex("]") + 1
        json_str = raw[start:end]

    try:
        tasks_data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse tasks for phase '%s': %s", phase.id, e)
        # Fallback: create a single generic task
        return [
            Task(
                id=f"{phase.id}-1",
                prompt=f"Complete the '{phase.name}' phase of the project. {_get_phase_description(phase.id)}",
                phase_id=phase.id,
            )
        ]

    tasks = []
    for t in tasks_data:
        tasks.append(
            Task(
                id=t["id"],
                prompt=t["prompt"],
                phase_id=phase.id,
                depends_on=t.get("depends_on"),
                validate=t.get("validate"),
            )
        )

    logger.info("Generated %d tasks for phase '%s'", len(tasks), phase.id)
    return tasks


def _get_phase_description(phase_id: str) -> str:
    """Get a description for a phase."""
    descriptions = {
        "scaffold": "Initialize project, install dependencies, set up config files, create directory structure",
        "database": "Set up database connection, define schema/models, create migrations, seed data",
        "auth": "Implement registration, login, session/JWT management, password reset, role-based middleware",
        "core-api": "Build main CRUD API routes, business logic, input validation, error handling",
        "payments": "Integrate payment provider, subscription management, webhooks, billing portal",
        "frontend": "Build UI pages, reusable components, layouts, navigation, responsive design",
        "integration": "Connect frontend forms/pages to API, implement data fetching, state management, error states",
        "testing": "Write unit tests, integration tests, and end-to-end tests for critical flows",
        "deploy": "Create Dockerfile, docker-compose, .env.example, CI/CD config, deployment documentation",
    }
    return descriptions.get(phase_id, "Complete this phase of the project")
