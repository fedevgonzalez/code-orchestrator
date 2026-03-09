/**
 * Interactive prompt detector — auto-responds to CLI prompts
 * from tools like create-next-app, npm init, nextspark init, etc.
 */

const BUILTIN_PATTERNS = [
  // Yes/No
  { regex: /\?\s+.+\(y\/N\)\s*$/im, response: "y" },
  { regex: /\?\s+.+\(Y\/n\)\s*$/im, response: "y" },
  { regex: /\?\s+.+\[y\/N\]\s*$/im, response: "y" },
  { regex: /\?\s+.+\[Y\/n\]\s*$/im, response: "y" },
  // Enter
  { regex: /Press Enter to continue/i, response: "" },
  { regex: /press ENTER/i, response: "" },
  // npm/npx
  { regex: /Ok to proceed\?/i, response: "y" },
  { regex: /Need to install the following packages/i, response: "y" },
  { regex: /Is this OK\?/i, response: "y" },
];

export class InteractiveDetector {
  /**
   * @param {Record<string, string>} customRules - Pattern → response map
   */
  constructor(customRules = {}) {
    this.customRules = customRules;
    this._buffer = [];
    this._maxBuffer = 50;
  }

  /**
   * Feed PTY output and check for prompts.
   * @param {string} output - New PTY output chunk
   * @returns {string|null} Response to send, or null if no prompt detected
   */
  detect(output) {
    const lines = output.split("\n");
    this._buffer.push(...lines);
    this._buffer = this._buffer.slice(-this._maxBuffer);

    const recent = this._buffer.slice(-5).join("\n");

    // Custom rules first (case-insensitive substring match)
    for (const [pattern, response] of Object.entries(this.customRules)) {
      if (recent.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`[INTERACTIVE] Matched: "${pattern}" → "${response}"`);
        this._buffer = [];
        return response;
      }
    }

    // Built-in regex patterns
    for (const { regex, response } of BUILTIN_PATTERNS) {
      if (regex.test(recent)) {
        console.log(`[INTERACTIVE] Matched regex: ${regex}`);
        this._buffer = [];
        return response;
      }
    }

    return null;
  }

  clear() {
    this._buffer = [];
  }
}
