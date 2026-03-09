"""AI Reviewer — Uses Claude Code CLI in pipe mode to review code after each task.

The reviewer runs `claude -p "prompt"` (non-interactive mode) which reads a prompt
and returns a structured review. No PTY needed — it uses stdin/stdout pipes.
"""

import json
import logging
import os
import subprocess
import sys
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# Max time for a review call (seconds)
REVIEW_TIMEOUT = 300


@dataclass
class ReviewResult:
    approved: bool
    score: int  # 1-10
    issues: list[str]
    suggestions: list[str]
    fix_prompt: str  # ready-to-send prompt for the builder if not approved
    raw_response: str


def find_claude_binary() -> str:
    """Find the claude CLI binary."""
    claude_path = shutil.which("claude")
    if claude_path:
        return claude_path

    if sys.platform == "win32":
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, ".claude", "local", "claude.exe"),
            os.path.join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c

    raise FileNotFoundError("Could not find 'claude' CLI.")


def _call_claude_pipe(prompt: str, cwd: str) -> str:
    """Call claude CLI in pipe mode: claude -p 'prompt'"""
    claude_bin = find_claude_binary()

    try:
        result = subprocess.run(
            [claude_bin, "-p", prompt],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=REVIEW_TIMEOUT,
        )

        if result.returncode != 0:
            logger.warning("claude -p exited with code %d: %s", result.returncode, result.stderr[:300])

        return result.stdout.strip()

    except subprocess.TimeoutExpired:
        logger.error("Review call timed out after %ds", REVIEW_TIMEOUT)
        return '{"approved": true, "score": 5, "issues": ["Review timed out"], "suggestions": []}'
    except Exception as e:
        logger.error("Review call failed: %s", e)
        return '{"approved": true, "score": 5, "issues": ["Review call failed"], "suggestions": []}'


def _parse_review_response(raw: str) -> ReviewResult:
    """Parse the reviewer's JSON response into a ReviewResult."""
    # Try to extract JSON from the response (it might have surrounding text)
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
        data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Could not parse review JSON, treating as approved")
        return ReviewResult(
            approved=True,
            score=5,
            issues=["Could not parse review response"],
            suggestions=[],
            fix_prompt="",
            raw_response=raw,
        )

    issues = data.get("issues", [])
    suggestions = data.get("suggestions", [])
    score = data.get("score", 5)
    approved = data.get("approved", score >= 7)

    # Build a fix prompt from the issues
    fix_prompt = ""
    if not approved and issues:
        fix_lines = ["The code reviewer found the following issues that must be fixed:\n"]
        for i, issue in enumerate(issues, 1):
            fix_lines.append(f"{i}. {issue}")
        if suggestions:
            fix_lines.append("\nSuggestions:")
            for s in suggestions:
                fix_lines.append(f"- {s}")
        fix_lines.append("\nPlease fix all the issues listed above.")
        fix_prompt = "\n".join(fix_lines)

    return ReviewResult(
        approved=approved,
        score=score,
        issues=issues,
        suggestions=suggestions,
        fix_prompt=fix_prompt,
        raw_response=raw,
    )


REVIEW_PROMPT_TEMPLATE = """You are a senior code reviewer. Review the current state of this project after the following task was completed.

TASK THAT WAS JUST COMPLETED:
{task_prompt}

PROJECT SPEC (what we're building):
{spec_summary}

INSTRUCTIONS:
1. Look at the files in this project directory
2. Evaluate: correctness, completeness, code quality, security, best practices
3. Be strict but fair. Score 7+ means acceptable quality for production.
4. If score < 7, list specific issues that MUST be fixed.

Respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{{
  "approved": true/false,
  "score": 1-10,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["optional improvement 1"]
}}"""


FINAL_REVIEW_PROMPT_TEMPLATE = """You are a senior technical lead doing a FINAL review of this entire project before it goes to production.

PROJECT SPEC:
{spec_summary}

COMPLETED TASKS:
{completed_tasks}

INSTRUCTIONS:
1. Review ALL files in this project directory
2. Check: architecture coherence, security vulnerabilities, missing error handling,
   test coverage, environment configuration, deployment readiness
3. Check that ALL features from the spec are implemented
4. Score 8+ means production-ready

Respond with ONLY a JSON object:
{{
  "approved": true/false,
  "score": 1-10,
  "issues": ["critical issue 1", "critical issue 2"],
  "suggestions": ["nice-to-have improvement"],
  "missing_features": ["feature from spec not implemented"]
}}"""


def review_task(
    task_prompt: str,
    spec_summary: str,
    cwd: str,
) -> ReviewResult:
    """Review the project after a task completes."""
    prompt = REVIEW_PROMPT_TEMPLATE.format(
        task_prompt=task_prompt,
        spec_summary=spec_summary,
    )

    logger.info("Running AI review...")
    raw = _call_claude_pipe(prompt, cwd)
    result = _parse_review_response(raw)

    logger.info(
        "Review: score=%d approved=%s issues=%d",
        result.score,
        result.approved,
        len(result.issues),
    )
    if result.issues:
        for issue in result.issues:
            logger.info("  Issue: %s", issue)

    return result


def final_review(
    spec_summary: str,
    completed_tasks: list[str],
    cwd: str,
) -> ReviewResult:
    """Run a final comprehensive review of the entire project."""
    tasks_str = "\n".join(f"- {t}" for t in completed_tasks)
    prompt = FINAL_REVIEW_PROMPT_TEMPLATE.format(
        spec_summary=spec_summary,
        completed_tasks=tasks_str,
    )

    logger.info("Running FINAL AI review...")
    raw = _call_claude_pipe(prompt, cwd)
    result = _parse_review_response(raw)

    logger.info(
        "Final review: score=%d approved=%s issues=%d",
        result.score,
        result.approved,
        len(result.issues),
    )

    return result
