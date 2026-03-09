"""Detect and auto-respond to interactive CLI prompts.

Handles prompts from tools like create-next-app, npm init, etc.
that require user input (yes/no, selections, enter to continue).
"""

import re
import logging

logger = logging.getLogger(__name__)

# Patterns that indicate an interactive prompt
PROMPT_PATTERNS = [
    # Yes/No prompts
    (r"\?\s+.+\(y/N\)\s*$", "y"),
    (r"\?\s+.+\(Y/n\)\s*$", "y"),
    (r"\?\s+.+\[y/N\]\s*$", "y"),
    (r"\?\s+.+\[Y/n\]\s*$", "y"),
    # Press enter
    (r"Press Enter to continue", ""),
    (r"press ENTER", ""),
    # npm/npx confirmations
    (r"Ok to proceed\?", "y"),
    (r"Need to install the following packages", "y"),
    (r"Is this OK\?", "y"),
]


class InteractivePromptDetector:
    """Detect interactive prompts in PTY output and generate responses."""

    def __init__(self, custom_rules: dict | None = None):
        self.custom_rules = custom_rules or {}
        self._buffer: list[str] = []
        self._max_buffer = 50

    def detect_and_respond(self, output: str) -> str | None:
        """Analyze PTY output for interactive prompts.

        Returns the response string if a prompt was detected, None otherwise.
        """
        # Add to buffer
        lines = output.split("\n")
        self._buffer.extend(lines)
        self._buffer = self._buffer[-self._max_buffer:]

        # Check the last few lines for prompts
        recent = "\n".join(self._buffer[-5:])

        # Custom rules first (from config)
        for pattern, response in self.custom_rules.items():
            if pattern.lower() in recent.lower():
                logger.info("Matched custom rule: %r -> %r", pattern, response)
                self._buffer.clear()
                return response

        # Built-in patterns
        for pattern, default_response in PROMPT_PATTERNS:
            if re.search(pattern, recent, re.IGNORECASE | re.MULTILINE):
                logger.info("Matched prompt pattern: %s", pattern)
                self._buffer.clear()
                return default_response

        return None

    def clear(self) -> None:
        """Clear the output buffer."""
        self._buffer.clear()
