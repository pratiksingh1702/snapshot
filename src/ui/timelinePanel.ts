import * as vscode from "vscode";
import { SnapshotMeta } from "../core/snapshotTypes";

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function createTimelinePanel(
    context: vscode.ExtensionContext,
    metas: SnapshotMeta[],
    fileName: string,
    onMessage: (message: any) => void
): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        "snapshotter.timeline",
        `Snapshot Timeline: ${fileName}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const itemsHtml = metas
        .map((m) => {
            const label = m.label || m.id;
            const created = new Date(m.createdAt).toLocaleString();
            const scopeIcon = m.scope === "file" ? "📄" : "🔍";
            return `
            <div class="item">
                <div class="left">
                    <div class="label">${scopeIcon} ${escapeHtml(label)}</div>
                    <div class="meta">${escapeHtml(created)}</div>
                </div>
                <div class="buttons">
                    <button class="btn restore" data-id="${m.id}">Restore</button>
                    <button class="btn diff" data-id="${m.id}">Diff</button>
                </div>
            </div>`;
        })
        .join("\n");

    panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-editor-background);
  padding: 10px;
}
h2 {
  margin-top: 0;
  font-size: 15px;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-weight: 500;
}
.meta {
  font-size: 11px;
  opacity: 0.7;
}
.buttons {
  display: flex;
  gap: 6px;
}
.btn {
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid transparent;
  padding: 3px 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  font-size: 11px;
}
.btn:hover {
  background: var(--vscode-button-hoverBackground);
}
.empty {
  opacity: 0.7;
  font-style: italic;
}
</style>
</head>
<body>
  <h2>Snapshot Timeline</h2>
  ${
      metas.length === 0
          ? `<div class="empty">No snapshots yet for this file.</div>`
          : `<div class="items">${itemsHtml}</div>`
  }
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.btn.restore').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'restoreSnapshot', id: btn.getAttribute('data-id') });
        });
    });
    document.querySelectorAll('.btn.diff').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'diffSnapshot', id: btn.getAttribute('data-id') });
        });
    });
  </script>
</body>
</html>
`;

    panel.webview.onDidReceiveMessage(onMessage, undefined, context.subscriptions);

    return panel;
}
