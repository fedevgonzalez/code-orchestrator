"""Browser session management using Playwright.

Provides screenshot capture, element checks, and user flow execution
for visual validation of the frontend.
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class BrowserSession:
    """Manage a headless browser for validation."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self._playwright = None
        self._browser = None
        self._page = None

    async def start(self) -> None:
        """Start the browser."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning(
                "playwright not installed. Browser validation disabled. "
                "Install with: pip install playwright && playwright install chromium"
            )
            return

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._page = await self._browser.new_page()
        logger.info("Browser session started (headless=%s)", self.headless)

    async def navigate(self, url: str) -> int:
        """Navigate to a URL. Returns HTTP status code."""
        if not self._page:
            return 0
        response = await self._page.goto(url, wait_until="networkidle", timeout=30000)
        return response.status if response else 0

    async def screenshot(self, path: str, full_page: bool = True) -> str | None:
        """Take a screenshot and save to path. Returns the path or None."""
        if not self._page:
            return None
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        await self._page.screenshot(path=path, full_page=full_page)
        logger.info("Screenshot saved: %s", path)
        return path

    async def element_exists(self, selector: str) -> bool:
        """Check if an element exists on the page."""
        if not self._page:
            return False
        element = await self._page.query_selector(selector)
        return element is not None

    async def fill(self, selector: str, value: str) -> None:
        """Fill an input field."""
        if self._page:
            await self._page.fill(selector, value)

    async def click(self, selector: str) -> None:
        """Click an element."""
        if self._page:
            await self._page.click(selector)

    async def wait_for(self, selector: str, timeout: int = 10000) -> bool:
        """Wait for an element to appear."""
        if not self._page:
            return False
        try:
            await self._page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception:
            return False

    async def get_text(self, selector: str) -> str:
        """Get text content of an element."""
        if not self._page:
            return ""
        element = await self._page.query_selector(selector)
        if element:
            return await element.text_content() or ""
        return ""

    async def current_url(self) -> str:
        """Get the current page URL."""
        if not self._page:
            return ""
        return self._page.url

    async def stop(self) -> None:
        """Close the browser."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._page = None
        self._browser = None
        self._playwright = None
        logger.info("Browser session stopped")


class FlowRunner:
    """Execute multi-step user flows for e2e validation."""

    def __init__(self, session: BrowserSession, screenshot_dir: str):
        self.session = session
        self.screenshot_dir = screenshot_dir

    async def run_flow(self, steps: list[dict]) -> tuple[bool, list[str]]:
        """Run a list of flow steps. Returns (success, errors)."""
        errors = []

        for i, step in enumerate(steps):
            action = step.get("action", "")
            try:
                if action == "navigate":
                    status = await self.session.navigate(step["url"])
                    if status >= 400:
                        errors.append(f"Step {i}: navigate to {step['url']} returned {status}")

                elif action == "fill":
                    await self.session.fill(step["selector"], step["value"])

                elif action == "click":
                    await self.session.click(step["selector"])

                elif action == "wait_for":
                    found = await self.session.wait_for(
                        step["selector"],
                        timeout=step.get("timeout", 10000),
                    )
                    if not found:
                        errors.append(f"Step {i}: element not found: {step['selector']}")

                elif action == "screenshot":
                    name = step.get("name", f"step_{i}")
                    path = os.path.join(self.screenshot_dir, f"{name}.png")
                    await self.session.screenshot(path)

                elif action == "assert_url":
                    url = await self.session.current_url()
                    expected = step.get("contains", "")
                    if expected not in url:
                        errors.append(f"Step {i}: URL '{url}' does not contain '{expected}'")

                elif action == "assert_text":
                    text = await self.session.get_text(step["selector"])
                    expected = step.get("contains", "")
                    if expected not in text:
                        errors.append(f"Step {i}: text '{text}' does not contain '{expected}'")

                elif action == "assert_exists":
                    exists = await self.session.element_exists(step["selector"])
                    if not exists:
                        errors.append(f"Step {i}: element not found: {step['selector']}")

                else:
                    logger.warning("Unknown flow action: %s", action)

            except Exception as e:
                errors.append(f"Step {i} ({action}): {e}")

        return len(errors) == 0, errors
