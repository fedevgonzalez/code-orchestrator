"""Analyze a product spec to extract structured information."""

import json
import logging

from reviewer import _call_claude_pipe

logger = logging.getLogger(__name__)

ANALYZE_PROMPT = """Analyze this product specification and extract structured information.

SPEC:
{spec}

Extract and return ONLY JSON (no markdown):
{{
  "project_name": "name",
  "tech_stack": {{
    "framework": "next.js/react/vue/etc",
    "language": "typescript/javascript",
    "css": "tailwind/css-modules/etc",
    "database": "postgresql/mysql/mongodb/sqlite",
    "orm": "prisma/drizzle/typeorm/none",
    "auth": "nextauth/clerk/custom/none",
    "payments": "stripe/none"
  }},
  "entities": ["User", "Project", "Task"],
  "features": [
    {{"name": "Authentication", "priority": "high", "complexity": "medium"}},
    {{"name": "Dashboard", "priority": "high", "complexity": "high"}}
  ],
  "api_endpoints": ["/api/auth/login", "/api/projects"],
  "pages": ["/", "/dashboard", "/login", "/projects/[id]"],
  "roles": ["admin", "member", "client"],
  "has_payments": true,
  "has_realtime": false,
  "deployment": "docker/vercel/none"
}}"""


def analyze_spec(spec_text: str, cwd: str) -> dict:
    """Analyze a spec and return structured data."""
    prompt = ANALYZE_PROMPT.format(spec=spec_text[:4000])

    logger.info("Analyzing spec...")
    raw = _call_claude_pipe(prompt, cwd)

    # Parse JSON from response
    json_str = raw
    if "```json" in raw:
        start = raw.index("```json") + 7
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "{" in raw:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        json_str = raw[start:end]

    try:
        analysis = json.loads(json_str)
        logger.info("Spec analysis: %s", analysis.get("project_name", "unknown"))
        logger.info("  Tech: %s + %s", analysis.get("tech_stack", {}).get("framework"), analysis.get("tech_stack", {}).get("database"))
        logger.info("  Entities: %s", analysis.get("entities", []))
        logger.info("  Features: %d", len(analysis.get("features", [])))
        return analysis
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse spec analysis: %s", e)
        return {"project_name": "unknown", "tech_stack": {}, "entities": [], "features": []}
