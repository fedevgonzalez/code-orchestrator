/**
 * PM2 Ecosystem Config — Code Orchestrator
 *
 * Usage:
 *   set ORCH_CWD=/path/to/project && set ORCH_SPEC=/path/to/project/spec.md && npx pm2 start ecosystem.config.cjs
 *
 * Control:
 *   npx pm2 logs code-orchestrator
 *   npx pm2 status
 *   npx pm2 stop code-orchestrator
 */

const path = require("path");

const PROJECT_CWD = process.env.ORCH_CWD;
const SPEC_PATH = process.env.ORCH_SPEC;

if (!PROJECT_CWD || !SPEC_PATH) {
  console.error("ERROR: Set ORCH_CWD and ORCH_SPEC environment variables first.");
  console.error("Example:");
  console.error('  set ORCH_CWD=/path/to/project && set ORCH_SPEC=/path/to/project/spec.md && npx pm2 start ecosystem.config.cjs');
  process.exit(1);
}

module.exports = {
  apps: [
    {
      name: "code-orchestrator",
      script: "watcher.mjs",
      cwd: __dirname,
      interpreter: "node",
      args: `--cwd "${PROJECT_CWD}" --spec "${SPEC_PATH}" --verbose`,

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "500M",

      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.join(PROJECT_CWD, ".orchestrator", "logs", "pm2-error.log"),
      out_file: path.join(PROJECT_CWD, ".orchestrator", "logs", "pm2-out.log"),
      merge_logs: true,

      env: {
        NODE_ENV: "production",
        ORCH_CWD: PROJECT_CWD,
        ORCH_SPEC: SPEC_PATH,
      },

      watch: false,
      kill_timeout: 15000,
    },
  ],
};
