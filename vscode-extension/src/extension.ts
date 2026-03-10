import * as vscode from "vscode";
import { OrchestratorRunner } from "./runner";
import { RunHistoryProvider } from "./run-history";
import { StatusBarManager } from "./status-bar";
import { analyzeFile } from "./file-analyzer";

let runner: OrchestratorRunner;
let statusBar: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
  runner = new OrchestratorRunner();
  statusBar = new StatusBarManager();

  const historyProvider = new RunHistoryProvider();
  vscode.window.registerTreeDataProvider("codeOrch.runsView", historyProvider);

  // Register webview provider for sidebar dashboard
  const dashboardViewProvider = new DashboardWebviewProvider(context, runner);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "codeOrch.dashboardView",
      dashboardViewProvider
    )
  );

  // Mode commands
  const modes = [
    "exec",
    "build",
    "fix",
    "audit",
    "review",
    "refactor",
    "test",
    "feature",
  ] as const;

  for (const mode of modes) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`codeOrch.${mode}`, async () => {
        const prompt = await vscode.window.showInputBox({
          prompt: `Enter ${mode} prompt`,
          placeHolder:
            mode === "build"
              ? "Path to spec file..."
              : `Describe what to ${mode}...`,
        });
        if (!prompt) return;
        await startRun(mode, prompt, context);
      })
    );
  }

  // Stop command
  context.subscriptions.push(
    vscode.commands.registerCommand("codeOrch.stop", async () => {
      const cwd = getWorkspaceCwd();
      if (!cwd) return;
      await runner.stop(cwd);
      statusBar.setIdle();
      vscode.window.showInformationMessage("Code Orchestrator stopped.");
    })
  );

  // Open dashboard in browser
  context.subscriptions.push(
    vscode.commands.registerCommand("codeOrch.dashboard", () => {
      const config = vscode.workspace.getConfiguration("codeOrchestrator");
      const cwd = getWorkspaceCwd();
      const port = cwd ? runner.discoverPort(cwd) : config.get<number>("dashboardPort", 3160);
      const token = config.get<string>("token", "");
      const url = token
        ? `http://localhost:${port}?token=${token}`
        : `http://localhost:${port}`;
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // View logs in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand("codeOrch.logs", async () => {
      const cwd = getWorkspaceCwd();
      if (!cwd) return;
      const terminal = vscode.window.createTerminal("Code Orchestrator Logs");
      terminal.show();
      terminal.sendText(`code-orch --logs "${cwd}"`);
    })
  );

  // Right-click file: Run with Code Orchestrator (smart analysis)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeOrch.runFromFile",
      async (uri: vscode.Uri) => {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) {
          vscode.window.showErrorMessage("No file selected.");
          return;
        }

        // Analyze the file to determine best approach
        let analysis;
        try {
          analysis = analyzeFile(filePath);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to analyze file: ${err.message}`);
          return;
        }

        const fileName = filePath.split(/[/\\]/).pop() || "file";
        const confidenceIcon = analysis.confidence === "high" ? "$(check)" : analysis.confidence === "medium" ? "$(info)" : "$(question)";

        // Build item summary for the detail view
        const bugs = analysis.items.filter((i) => i.type === "bug");
        const features = analysis.items.filter((i) => i.type === "feature");
        const itemSummary = [
          bugs.length > 0 ? `${bugs.length} bugs` : "",
          features.length > 0 ? `${features.length} features` : "",
          analysis.items.length - bugs.length - features.length > 0
            ? `${analysis.items.length - bugs.length - features.length} other items`
            : "",
        ].filter(Boolean).join(", ");

        // Show recommendation with options
        const options = [
          {
            label: `${confidenceIcon} ${analysis.modeLabel} (Recommended)`,
            description: `mode: ${analysis.mode}`,
            detail: `${analysis.summary}${itemSummary ? ` | Found: ${itemSummary}` : ""}`,
            isRecommended: true,
          },
          { label: "$(edit) Customize prompt before running", description: "Edit the generated prompt", detail: analysis.prompt.slice(0, 120) + "...", isRecommended: false },
          { label: "---", kind: vscode.QuickPickItemKind.Separator } as any,
          { label: "$(play) exec", description: "Custom prompt", isRecommended: false },
          { label: "$(tools) build", description: "Build from spec", isRecommended: false },
          { label: "$(wrench) fix", description: "Fix bugs/issues", isRecommended: false },
          { label: "$(search) audit", description: "Audit codebase", isRecommended: false },
          { label: "$(eye) review", description: "Review code", isRecommended: false },
          { label: "$(references) refactor", description: "Refactor code", isRecommended: false },
          { label: "$(beaker) test", description: "Generate tests", isRecommended: false },
          { label: "$(star) feature", description: "Implement features", isRecommended: false },
        ];

        const pick = await vscode.window.showQuickPick(options, {
          placeHolder: `Analyzing ${fileName}...`,
          title: "Code Orchestrator — Smart Analysis",
        });

        if (!pick) return;

        let mode: string;
        let prompt: string;

        if ((pick as any).isRecommended === true) {
          // Use AI recommendation
          mode = analysis.mode;
          prompt = analysis.prompt;
        } else if (pick.label.includes("Customize")) {
          // Let user edit the prompt
          const edited = await vscode.window.showInputBox({
            prompt: `Edit prompt (mode: ${analysis.mode})`,
            value: analysis.prompt,
            valueSelection: undefined,
          });
          if (!edited) return;
          mode = analysis.mode;
          prompt = edited;
        } else {
          // Manual mode selection
          const modeMatch = pick.label.match(/\)\s*(\w+)$/);
          mode = modeMatch ? modeMatch[1] : "exec";
          if (mode === "build") {
            prompt = filePath;
          } else {
            const userPrompt = await vscode.window.showInputBox({
              prompt: `Enter ${mode} prompt (file: ${fileName})`,
              value: `Read ${fileName} at ${filePath} and execute all items described in it.`,
            });
            if (!userPrompt) return;
            prompt = userPrompt;
          }
        }

        await startRun(mode, prompt, context);
      }
    )
  );

  // Status bar
  context.subscriptions.push(statusBar.item);

  console.log("Code Orchestrator extension activated");
}

async function startRun(
  mode: string,
  prompt: string,
  context: vscode.ExtensionContext
) {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  // Check for existing running instance
  const existing = runner.checkRunning(cwd);
  if (existing) {
    const action = await vscode.window.showWarningMessage(
      `An orchestrator is already running for this project.\n\n` +
        `Instance: ${existing.name} (PID ${existing.pid})\n` +
        `Status: ${existing.status} | Uptime: ${existing.uptime} | Memory: ${existing.memory}\n\n` +
        `Starting a new run will stop the current one.`,
      { modal: true },
      "Stop & Start New Run",
      "Open Dashboard Instead"
    );

    if (action === "Open Dashboard Instead") {
      vscode.commands.executeCommand("codeOrch.dashboard");
      return;
    }
    if (action !== "Stop & Start New Run") {
      return; // Cancelled
    }

    // Stop the existing instance first
    statusBar.setRunning("stopping...");
    await runner.stop(cwd);
    // Brief pause to let PM2 clean up
    await new Promise((r) => setTimeout(r, 2000));
  }

  const config = vscode.workspace.getConfiguration("codeOrchestrator");
  const autoOpen = config.get<boolean>("autoOpenDashboard", true);

  statusBar.setRunning(mode);

  try {
    const result = await runner.start(mode, prompt, cwd);
    if (result.success) {
      vscode.window.showInformationMessage(
        `Code Orchestrator (${mode}) started for ${cwd}`
      );
      if (autoOpen) {
        vscode.commands.executeCommand("codeOrch.dashboardView.focus");
      }
      // Start polling for status
      pollStatus(cwd, context);
    } else {
      statusBar.setError();
      vscode.window.showErrorMessage(`Failed to start: ${result.error}`);
    }
  } catch (err: any) {
    statusBar.setError();
    vscode.window.showErrorMessage(`Error: ${err.message}`);
  }
}

async function pollStatus(
  cwd: string,
  context: vscode.ExtensionContext
) {
  const config = vscode.workspace.getConfiguration("codeOrchestrator");
  const port = runner.discoverPort(cwd);
  const token = config.get<string>("token", "");

  const interval = setInterval(async () => {
    try {
      const state = await runner.getState(port, token);
      if (!state) return;

      const orch = state.orchestrator;
      if (orch?.status === "completed") {
        statusBar.setCompleted(state.cost);
        clearInterval(interval);
        vscode.window.showInformationMessage(
          `Code Orchestrator completed! Cost: $${(state.cost || 0).toFixed(2)}`
        );
      } else if (orch?.status === "crashed" || orch?.status === "stopped") {
        statusBar.setIdle();
        clearInterval(interval);
      } else if (orch?.phases) {
        const totalTasks = orch.phases.reduce(
          (s: number, p: any) => s + (p.tasks?.length || 0),
          0
        );
        const doneTasks = orch.phases.reduce(
          (s: number, p: any) =>
            s + (p.tasks?.filter((t: any) => t.status === "done").length || 0),
          0
        );
        statusBar.setProgress(doneTasks, totalTasks, state.cost);
      }
    } catch {
      // Server not reachable, will retry
    }
  }, 5000);

  // Clean up on deactivation
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

function getWorkspaceCwd(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return folders[0].uri.fsPath;
}

class DashboardWebviewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly runner: OrchestratorRunner
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    const config = vscode.workspace.getConfiguration("codeOrchestrator");
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const port = cwd ? this.runner.discoverPort(cwd) : config.get<number>("dashboardPort", 3160);
    const token = config.get<string>("token", "");
    const tokenQuery = token ? `?token=${token}` : "";

    webviewView.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px; }
    .container { padding: 8px; }
    .status { padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; }
    .status.connected { background: rgba(59,185,80,0.1); border: 1px solid rgba(59,185,80,0.3); color: #3fb950; }
    .status.disconnected { background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3); color: #f85149; }
    .stat-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--vscode-widget-border); }
    .stat-label { opacity: 0.7; }
    .stat-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .phase { padding: 6px 8px; margin: 4px 0; border-radius: 4px; background: var(--vscode-list-hoverBackground); font-size: 12px; }
    .phase .name { font-weight: 500; }
    .phase .meta { opacity: 0.6; font-size: 11px; }
    .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; }
    .dot.done { background: #3fb950; }
    .dot.running { background: #58a6ff; animation: pulse 1.5s infinite; }
    .dot.pending { background: #6e7681; }
    .dot.failed { background: #f85149; }
    .open-btn { width: 100%; padding: 6px; margin-top: 8px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; cursor: pointer; font-family: inherit; }
    .open-btn:hover { background: var(--vscode-button-hoverBackground); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .log { font-family: var(--vscode-editor-font-family); font-size: 11px; max-height: 200px; overflow-y: auto; padding: 4px; background: var(--vscode-editor-background); border-radius: 4px; margin-top: 8px; }
    .log-line { white-space: pre-wrap; word-break: break-all; padding: 1px 0; }
    .log-line.success { color: #3fb950; }
    .log-line.error { color: #f85149; }
    .log-line.orch { color: #d2a8ff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="status disconnected" id="connStatus">Connecting...</div>
    <div id="stats"></div>
    <div id="phases"></div>
    <button class="open-btn" onclick="openExternal()">Open Full Dashboard</button>
    <div class="log" id="log"></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const PORT = ${port};
    const TOKEN_QUERY = '${tokenQuery}';
    let ws;

    function connect() {
      ws = new WebSocket('ws://localhost:' + PORT + TOKEN_QUERY);
      ws.onopen = () => {
        document.getElementById('connStatus').className = 'status connected';
        document.getElementById('connStatus').textContent = 'Connected';
      };
      ws.onclose = () => {
        document.getElementById('connStatus').className = 'status disconnected';
        document.getElementById('connStatus').textContent = 'Disconnected — retrying...';
        setTimeout(connect, 3000);
      };
      ws.onmessage = (evt) => {
        const d = JSON.parse(evt.data);
        handleEvent(d);
      };
    }

    function handleEvent(d) {
      if (d.type === 'initial_state' || d.type === 'state_update') {
        if (d.phases || d.orchestrator?.phases) {
          renderPhases(d.phases || d.orchestrator.phases);
        }
        if (d.orchestrator) {
          renderStats(d);
        }
      }
      if (d.type === 'log' || d.type === 'task_done' || d.type === 'phase_done' || d.type === 'run_complete') {
        addLog(d);
      }
    }

    function renderStats(d) {
      const orch = d.orchestrator || {};
      const phases = orch.phases || d.phases || [];
      const total = phases.reduce((s, p) => s + (p.tasks?.length || 0), 0);
      const done = phases.reduce((s, p) => s + (p.tasks?.filter(t => t.status === 'done').length || 0), 0);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      document.getElementById('stats').innerHTML =
        '<div class="stat-row"><span class="stat-label">Status</span><span class="stat-value">' + (orch.status || '—') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Progress</span><span class="stat-value">' + done + '/' + total + ' (' + pct + '%)</span></div>' +
        '<div class="stat-row"><span class="stat-label">Mode</span><span class="stat-value">' + (d.mode || '—') + '</span></div>';
    }

    function renderPhases(phases) {
      if (!phases) return;
      let html = '';
      phases.forEach(p => {
        const done = p.tasks?.filter(t => t.status === 'done').length || 0;
        const total = p.tasks?.length || 0;
        const status = p.status || 'pending';
        html += '<div class="phase"><span class="dot ' + status + '"></span><span class="name">' + esc(p.name || p.id) + '</span><div class="meta">' + done + '/' + total + ' tasks</div></div>';
      });
      document.getElementById('phases').innerHTML = html;
    }

    function addLog(d) {
      const log = document.getElementById('log');
      const line = document.createElement('div');
      let cls = 'log-line';
      let text = '';

      if (d.type === 'log') { text = d.text || ''; cls += d.text?.includes('ERR') ? ' error' : ' orch'; }
      else if (d.type === 'task_done') { text = 'Task ' + d.taskId + ' done (score: ' + d.score + ')'; cls += ' success'; }
      else if (d.type === 'phase_done') { text = 'Phase ' + d.phaseId + ' completed'; cls += ' success'; }
      else if (d.type === 'run_complete') { text = 'Run complete: ' + d.status; cls += d.status === 'completed' ? ' success' : ' error'; }

      if (text) {
        line.className = cls;
        line.textContent = text;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 100) log.removeChild(log.firstChild);
      }
    }

    function esc(s) { return s ? s.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

    function openExternal() {
      vscode.postMessage({ command: 'openDashboard' });
    }

    connect();

    // Poll state every 10s as backup
    setInterval(async () => {
      try {
        const res = await fetch('http://localhost:' + PORT + '/state');
        const d = await res.json();
        if (d.orchestrator?.phases) renderPhases(d.orchestrator.phases);
        renderStats(d);
      } catch {}
    }, 10000);
  </script>
</body>
</html>`;

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === "openDashboard") {
        vscode.commands.executeCommand("codeOrch.dashboard");
      }
    });
  }
}

export function deactivate() {
  statusBar?.dispose();
}
