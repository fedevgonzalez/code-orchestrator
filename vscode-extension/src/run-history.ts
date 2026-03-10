import * as vscode from "vscode";
import * as http from "http";

interface RunRecord {
  runId: string;
  mode: string;
  status: string;
  completedTasks: number;
  totalTasks: number;
  durationMs: number;
  startedAt: string;
}

export class RunHistoryProvider implements vscode.TreeDataProvider<RunItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RunItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private runs: RunRecord[] = [];

  constructor() {
    this.refresh();
    // Auto-refresh every 30s
    setInterval(() => this.refresh(), 30000);
  }

  refresh() {
    this.fetchHistory()
      .then((runs) => {
        this.runs = runs;
        this._onDidChangeTreeData.fire(undefined);
      })
      .catch(() => {});
  }

  getTreeItem(element: RunItem): vscode.TreeItem {
    return element;
  }

  getChildren(): RunItem[] {
    if (this.runs.length === 0) {
      const empty = new RunItem("No runs yet", "", "");
      empty.description = "Start a run from the command palette";
      return [empty];
    }

    return this.runs
      .slice()
      .reverse()
      .map((run) => {
        const dur = this.formatDuration(run.durationMs);
        const date = run.startedAt
          ? new Date(run.startedAt).toLocaleDateString()
          : "";
        const icon =
          run.status === "completed"
            ? "$(check)"
            : run.status === "failed"
            ? "$(error)"
            : "$(clock)";

        const item = new RunItem(
          `${icon} ${run.mode}`,
          `${run.completedTasks}/${run.totalTasks} tasks | ${dur}`,
          run.runId
        );
        item.description = `${date} — ${run.status}`;
        item.tooltip = `Run: ${run.runId}\nMode: ${run.mode}\nStatus: ${run.status}\nTasks: ${run.completedTasks}/${run.totalTasks}\nDuration: ${dur}`;
        return item;
      });
  }

  private async fetchHistory(): Promise<RunRecord[]> {
    const config = vscode.workspace.getConfiguration("codeOrchestrator");
    const port = config.get<number>("dashboardPort", 3160);
    const token = config.get<string>("token", "");

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const req = http.get(
        `http://localhost:${port}/state`,
        { headers },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const state = JSON.parse(data);
              resolve(state.history || []);
            } catch {
              resolve([]);
            }
          });
        }
      );
      req.on("error", () => resolve([]));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve([]);
      });
    });
  }

  private formatDuration(ms: number): string {
    if (!ms) return "-";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }
}

class RunItem extends vscode.TreeItem {
  constructor(label: string, detail: string, runId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.id = runId;
  }
}
