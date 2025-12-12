"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimelinePanel = createTimelinePanel;
const vscode = __importStar(require("vscode"));
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function createTimelinePanel(context, metas, fileName, onMessage) {
    const panel = vscode.window.createWebviewPanel("snapshotter.timeline", `Snapshot Timeline: ${fileName}`, vscode.ViewColumn.Beside, { enableScripts: true });
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
  ${metas.length === 0
        ? `<div class="empty">No snapshots yet for this file.</div>`
        : `<div class="items">${itemsHtml}</div>`}
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
