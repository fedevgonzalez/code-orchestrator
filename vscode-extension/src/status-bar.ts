import * as vscode from "vscode";

export class StatusBarManager {
  readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    this.item.command = "codeOrch.dashboard";
    this.setIdle();
    this.item.show();
  }

  setIdle() {
    this.item.text = "$(circuit-board) Code Orch";
    this.item.tooltip = "Code Orchestrator — Click to open dashboard";
    this.item.backgroundColor = undefined;
  }

  setRunning(mode: string) {
    this.item.text = `$(sync~spin) Code Orch: ${mode}`;
    this.item.tooltip = "Code Orchestrator — Running...";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  setProgress(done: number, total: number, cost?: number) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const costStr = cost ? ` | $${cost.toFixed(2)}` : "";
    this.item.text = `$(sync~spin) Code Orch: ${done}/${total} (${pct}%)${costStr}`;
    this.item.tooltip = `Code Orchestrator — ${done} of ${total} tasks done${costStr}`;
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  setCompleted(cost?: number) {
    const costStr = cost ? ` | $${cost.toFixed(2)}` : "";
    this.item.text = `$(check) Code Orch: Done${costStr}`;
    this.item.tooltip = "Code Orchestrator — Completed";
    this.item.backgroundColor = undefined;
  }

  setError() {
    this.item.text = "$(error) Code Orch: Error";
    this.item.tooltip = "Code Orchestrator — Error";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
  }

  dispose() {
    this.item.dispose();
  }
}
