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
exports.activate = activate;
exports.deactivate = deactivate;
exports.registerSplitTimeline = registerSplitTimeline;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const snapshotService_1 = require("./core/snapshotService");
const timelinePanel_1 = require("./ui/timelinePanel");
const timelineView_1 = require("./ui/timelineView");
const snapshotStore_1 = require("./core/snapshotStore");
const timelineProvider = new timelineView_1.TimelineProvider();
vscode.window.registerTreeDataProvider("snapshotterTimeline", timelineProvider);
;
// For diff: virtual snapshot provider
class SnapshotContentProvider {
    constructor() {
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
        this.cache = new Map();
    }
    setContent(id, content) {
        this.cache.set(id, content);
        this._onDidChange.fire(vscode.Uri.parse(`snapshotter:${id}`));
    }
    provideTextDocumentContent(uri) {
        const id = uri.path.replace(/^\//, "");
        return this.cache.get(id) ?? "// Snapshot not found";
    }
}
let statusBarItem;
const contentProvider = new SnapshotContentProvider();
function activate(context) {
    console.log("Snapshotter activated");
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("snapshotter", contentProvider));
    // Status bar button
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "⚡ Snapshot";
    statusBarItem.command = "snapshotter.createSnapshot";
    statusBarItem.tooltip = "Create snapshot for current file or selection";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    vscode.commands.registerCommand("snapshotter.refreshTimeline", () => {
        timelineProvider.refresh();
    });
    registerSplitTimeline(context);
    vscode.commands.registerCommand("snapshotter.deleteSnapshot", async (node) => {
        const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(node.filePath));
        if (!workspace || !node.snapshot)
            return;
        const relPath = path.relative(workspace.uri.fsPath, node.filePath);
        (0, snapshotStore_1.deleteSnapshotFile)(workspace, relPath, node.snapshot.id);
        vscode.window.showInformationMessage("Snapshot deleted.");
        timelineProvider.refresh();
    });
    vscode.commands.registerCommand("snapshotter.deleteFileSnapshots", async (node) => {
        const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(node.filePath));
        if (!workspace)
            return;
        const relPath = path.relative(workspace.uri.fsPath, node.filePath);
        (0, snapshotStore_1.deleteSnapshotFolder)(workspace, relPath);
        vscode.window.showInformationMessage("All snapshots deleted for this file.");
        timelineProvider.refresh();
    });
    // const openSplitTimelineCmd = vscode.commands.registerCommand(
    //     "snapshotter.openSplitTimeline",
    //     async () => {
    //         const editor = vscode.window.activeTextEditor;
    //         if (!editor) {
    //             return vscode.window.showErrorMessage("Open a file first.");
    //         }
    //         const metas = listSnapshotsForDocument(editor.document);
    //         const fileName = editor.document.fileName.split(/[\\/]/).pop() ?? "file";
    //         const panel = vscode.window.createWebviewPanel(
    //             "snapshotterTimelineSplit",
    //             `Timeline — ${fileName}`,
    //             vscode.ViewColumn.Beside,
    //             {
    //                 enableScripts: true,
    //                 retainContextWhenHidden: true,
    //             }
    //         );
    //         panel.webview.html = getTimelineWebviewHTML(metas, fileName);
    //         // Handle messages from the timeline UI
    //         panel.webview.onDidReceiveMessage(async (msg) => {
    //             if (!msg.type || !msg.id) return;
    //             const snap = loadSnapshotForDocument(editor.document, msg.id);
    //             if (!snap) return vscode.window.showErrorMessage("Snapshot not found.");
    //             if (msg.type === "restore") {
    //                 const confirm = await vscode.window.showWarningMessage(
    //                     "Restore this snapshot?",
    //                     { modal: true },
    //                     "Yes"
    //                 );
    //                 if (confirm === "Yes") {
    //                     await restoreSnapshotIntoEditor(editor, snap);
    //                     vscode.window.showInformationMessage("Restored snapshot.");
    //                 }
    //             }
    //             if (msg.type === "diff") {
    //                 await openDiffForSnapshot(editor.document, snap.meta, snap.content);
    //             }
    //         });
    //     }
    // );
    // context.subscriptions.push(openSplitTimelineCmd);
    // Create snapshot command
    const createSnapshotCmd = vscode.commands.registerCommand("snapshotter.createSnapshot", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage("No active editor.");
        const hasSel = !editor.selection.isEmpty;
        const label = await vscode.window.showInputBox({
            prompt: "Optional snapshot label"
        });
        const snap = await (0, snapshotService_1.createSnapshotForEditor)(editor, hasSel ? "snippet" : "file", label || undefined);
        if (snap) {
            vscode.window.showInformationMessage(`Snapshot created at ${new Date(snap.meta.createdAt).toLocaleTimeString()}`);
        }
    });
    // List snapshots / restore / diff
    const listSnapshotsCmd = vscode.commands.registerCommand("snapshotter.listSnapshots", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage("No active editor.");
        const metas = (0, snapshotService_1.listSnapshotsForDocument)(editor.document);
        if (metas.length === 0) {
            return vscode.window.showInformationMessage("No snapshots for this file.");
        }
        const items = metas.map(m => ({
            label: `${m.scope === "file" ? "📄" : "🔍"} ${m.label || m.id}`,
            description: new Date(m.createdAt).toLocaleString(),
            meta: m
        }));
        const selected = await vscode.window.showQuickPick(items);
        if (!selected)
            return;
        const action = await vscode.window.showQuickPick(["Restore into editor", "Open diff"], { placeHolder: "Choose action" });
        if (!action)
            return;
        const snap = (0, snapshotService_1.loadSnapshotForDocument)(editor.document, selected.meta.id);
        if (!snap)
            return vscode.window.showErrorMessage("Snapshot load failed.");
        if (action.startsWith("Restore")) {
            const confirm = await vscode.window.showWarningMessage("Replace editor content?", { modal: true }, "Restore");
            if (confirm === "Restore") {
                await (0, snapshotService_1.restoreSnapshotIntoEditor)(editor, snap);
                vscode.window.showInformationMessage("Snapshot restored.");
            }
        }
        else {
            await openDiffForSnapshot(editor.document, snap.meta, snap.content);
        }
    });
    // Timeline panel
    const openTimelineCmd = vscode.commands.registerCommand("snapshotter.openTimeline", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage("No active editor.");
        const metas = (0, snapshotService_1.listSnapshotsForDocument)(editor.document);
        const fileName = editor.document.fileName.split(/[\\/]/).pop() ?? "file";
        const panel = (0, timelinePanel_1.createTimelinePanel)(context, metas, fileName, async (message) => {
            if (!message || !message.type || !message.id)
                return;
            const snap = (0, snapshotService_1.loadSnapshotForDocument)(editor.document, message.id);
            if (!snap)
                return vscode.window.showErrorMessage("Snapshot not found.");
            if (message.type === "restoreSnapshot") {
                const confirm = await vscode.window.showWarningMessage("Restore snapshot?", { modal: true }, "Restore");
                if (confirm === "Restore") {
                    await (0, snapshotService_1.restoreSnapshotIntoEditor)(editor, snap);
                }
            }
            else if (message.type === "diffSnapshot") {
                await openDiffForSnapshot(editor.document, snap.meta, snap.content);
            }
        });
        context.subscriptions.push(panel);
    });
    const createSnippetSnapshotCmd = vscode.commands.registerCommand("snapshotter.createSnippetSnapshot", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return vscode.window.showErrorMessage("No active editor.");
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            return vscode.window.showErrorMessage("No text selected.");
        }
        // Auto-suggest function name if selection starts at `function`, `def`, `class`, etc.
        const selectedText = editor.document.getText(selection);
        const autoLabel = selectedText.split(/\n/)[0].trim().slice(0, 50) || "Snippet";
        const label = await vscode.window.showInputBox({
            prompt: "Label for this snippet snapshot:",
            placeHolder: autoLabel,
            value: autoLabel
        });
        const snap = await (0, snapshotService_1.createSnapshotForEditor)(editor, "snippet", label || autoLabel);
        if (snap) {
            vscode.window.showInformationMessage(`Snippet snapshot saved (${snap.meta.label})`);
        }
    });
    context.subscriptions.push(createSnippetSnapshotCmd);
    context.subscriptions.push(createSnippetSnapshotCmd);
    // Experiment Mode — FULL FIXED VERSION
    const experimentCmd = vscode.commands.registerCommand("snapshotter.experimentMode", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage("No active editor.");
        const document = editor.document;
        if (document.isUntitled) {
            return vscode.window.showErrorMessage("Cannot run experiment on unsaved file.");
        }
        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspace)
            return;
        const metas = (0, snapshotService_1.listSnapshotsForDocument)(document);
        if (metas.length === 0) {
            return vscode.window.showInformationMessage("No snapshots for this file.");
        }
        const items = metas.map(m => ({
            label: `${m.scope === "file" ? "📄" : "🔍"} ${m.label || m.id}`,
            description: new Date(m.createdAt).toLocaleString(),
            meta: m
        }));
        const chosen = await vscode.window.showQuickPick(items, {
            placeHolder: "Select snapshot for Experiment Mode",
            canPickMany: false
        });
        if (!chosen)
            return;
        const snap = (0, snapshotService_1.loadSnapshotForDocument)(document, chosen.meta.id);
        if (!snap)
            return vscode.window.showErrorMessage("Snapshot load failed.");
        // Entry file picker
        const entryPick = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Select file to run",
            defaultUri: workspace.uri,
            filters: { "All files": ["*"] }
        });
        if (!entryPick)
            return;
        const entryFileAbsolute = entryPick[0].fsPath;
        // Ask for command
        const runCommand = await vscode.window.showInputBox({
            prompt: "Enter run command (without file)",
            placeHolder: "python | node | dart | flutter run",
            value: "python"
        });
        if (!runCommand)
            return;
        // Apply choice dialog
        const applyChoice = await vscode.window.showQuickPick([
            {
                label: "▶ Use snapshot temporarily",
                description: "Auto-revert after experiment"
            },
            {
                label: "✔ Keep snapshot permanently",
                description: "Save snapshot into actual file"
            },
            {
                label: "✖ Cancel"
            }
        ], { placeHolder: "How do you want to use this snapshot?" });
        if (!applyChoice || applyChoice.label.startsWith("✖")) {
            vscode.window.showInformationMessage("Experiment cancelled.");
            return;
        }
        const fs = require("fs");
        const originalContent = fs.readFileSync(document.uri.fsPath, "utf8");
        const filePath = document.uri.fsPath;
        // Permanent apply
        if (applyChoice.label.startsWith("✔")) {
            fs.writeFileSync(filePath, snap.content, "utf8");
            await vscode.commands.executeCommand("workbench.action.files.revert");
            vscode.window.showInformationMessage("Snapshot applied permanently.");
            return;
        }
        // Temporary apply
        fs.writeFileSync(filePath, snap.content, "utf8");
        vscode.window.showInformationMessage("Snapshot applied temporarily.");
        const terminal = vscode.window.createTerminal("Experiment Mode");
        terminal.show();
        if (runCommand.includes("flutter run")) {
            terminal.sendText(runCommand);
        }
        else {
            terminal.sendText(`${runCommand} "${entryFileAbsolute}"`);
        }
        // Auto revert after terminal closes
        const watcher = vscode.window.onDidCloseTerminal(async (t) => {
            if (t.name !== "Experiment Mode")
                return;
            fs.writeFileSync(filePath, originalContent, "utf8");
            await vscode.commands.executeCommand("workbench.action.files.revert");
            vscode.window.showInformationMessage("Experiment complete — file restored.");
            watcher.dispose();
        });
    });
    context.subscriptions.push(createSnapshotCmd, listSnapshotsCmd, openTimelineCmd, experimentCmd);
}
async function openDiffForSnapshot(document, meta, content) {
    const id = meta.id;
    const leftUri = vscode.Uri.parse(`snapshotter:/${id}`);
    contentProvider.setContent(id, content);
    await vscode.commands.executeCommand("vscode.diff", leftUri, document.uri, `Snapshot (${meta.label || meta.id}) ↔ Current`);
}
function deactivate() { }
function getTimelineWebviewHTML(webview, extensionPath, metas, fileName) {
    // serialize metas safely
    const safeMetas = metas.map(m => ({
        id: m.id,
        label: m.label || m.id,
        createdAt: m.createdAt,
        scope: m.scope,
        filePath: m.filePath,
        // don't include full content; include preview length for UI
    }));
    const initialPayload = JSON.stringify({ metas: safeMetas, fileName });
    // inline SVG for node icon
    const nodeSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#5B8DEF"/></svg>`);
    return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'unsafe-inline' ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Snapshot Timeline — ${fileName}</title>
    <style>
      :root{
        --bg:#0f1115;
        --card:#0f1720;
        --muted:#9aa4b2;
        --accent:#5B8DEF;
        --accent-2:#7ee0b1;
        --glass: rgba(255,255,255,0.02);
      }
      html,body{height:100%;margin:0;background:linear-gradient(180deg,#0b0d10 0%, #0f1418 100%);color:#dbe6ef;font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;}
      .container{display:flex;flex-direction:column;height:100%;padding:18px;box-sizing:border-box;gap:14px;}
      .header{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .title{display:flex;align-items:center;gap:12px;}
      .title .icon{width:44px;height:44px;background:linear-gradient(135deg,var(--accent),#3759f1);border-radius:10px;box-shadow: 0 8px 30px rgba(59,103,217,0.18);display:flex;align-items:center;justify-content:center;}
      .title h2{margin:0;font-size:14px;letter-spacing:0.2px;}
      .subtitle{color:var(--muted);font-size:12px;margin-top:2px;}
      .actions{display:flex;gap:8px;align-items:center;}
      .btn{background:var(--glass);border:1px solid rgba(255,255,255,0.03);padding:8px 10px;border-radius:8px;color:var(--muted);cursor:pointer;font-size:12px;}
      .btn.primary{background:linear-gradient(90deg,var(--accent),#4aa3ff);color:#fff;border:none;box-shadow:0 6px 18px rgba(91,141,239,0.12)}
      .panel{display:flex;gap:16px;flex:1;align-items:flex-start;}
      /* timeline column */
      .timeline{width:470px;max-width:47%;min-width:360px;position:relative;padding:18px;border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));box-shadow: 0 10px 40px rgba(2,6,23,0.6);overflow:auto;}
      /* detail column */
      .detail{flex:1;min-width:360px;padding:18px;border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005));box-shadow: 0 10px 40px rgba(2,6,23,0.6);overflow:auto;}
      .timeline .line{position:absolute;left:56px;top:32px;bottom:32px;width:3px;background:linear-gradient(180deg, rgba(91,141,239,0.9), rgba(122,210,179,0.9));border-radius:3px;box-shadow:0 4px 18px rgba(91,141,239,0.06)}
      .node-wrap{position:relative;margin-bottom:18px;display:flex;gap:14px;align-items:flex-start;}
      .node-icon{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#22324d 0%, #162333 100%);display:flex;align-items:center;justify-content:center;box-shadow: 0 8px 30px rgba(0,0,0,0.6);flex-shrink:0;transform:translateZ(0);}
      .node-card{flex:1;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:12px;padding:12px 14px;backdrop-filter: blur(6px);box-shadow: 0 10px 30px rgba(2,6,23,0.6);transition: transform 220ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms;transform-origin:left center;}
      .node-card:hover{transform: translateX(6px) translateY(-4px) scale(1.01);box-shadow:0 20px 48px rgba(2,6,23,0.75)}
      .node-card .meta{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .label{font-weight:600;color:#eaf4ff;}
      .time{font-size:12px;color:var(--muted);}
      .badges{display:flex;gap:8px;align-items:center;margin-top:8px;}
      .badge{font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.02);color:var(--muted);border:1px solid rgba(255,255,255,0.02)}
      .actions-row{display:flex;gap:8px;margin-top:10px;}
      .action-btn{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.03);padding:6px 8px;border-radius:8px;color:var(--muted);cursor:pointer;font-size:12px;}
      .action-btn.ghost{background:transparent;border:1px dashed rgba(255,255,255,0.03);}
      .card-preview{margin-top:10px;color:var(--muted);font-size:12px;line-height:1.45;max-height:68px;overflow:hidden;}
      /* connector small dot */
      .dot{position:absolute;left:44px;top:20px;width:8px;height:8px;border-radius:50%;background:linear-gradient(90deg,var(--accent),var(--accent-2));box-shadow:0 6px 18px rgba(91,141,239,0.12)}
      /* detail pane */
      .detail .title{font-size:13px;font-weight:700;margin-bottom:6px;}
      .detail .subtitle{color:var(--muted);font-size:13px;margin-bottom:14px;}
      .detail .meta-grid{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
      .pill{background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;color:var(--muted);font-size:13px;border:1px solid rgba(255,255,255,0.02)}
      /* responsive */
      @media (max-width:980px){
        .container{padding:12px}
        .panel{flex-direction:column}
        .timeline{width:100%;max-width:none}
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="title">
          <div class="icon"><img src="data:image/svg+xml;utf8,${nodeSvg}" width="20" height="20" /></div>
          <div>
            <h2>Snapshot Timeline</h2>
            <div class="subtitle">File — <strong>${fileName}</strong></div>
          </div>
        </div>
        <div class="actions">
          <button class="btn" id="create-snippet">➕ Snippet</button>
          <button class="btn" id="delete-all">🗑️ Delete all</button>
          <button class="btn primary" id="refresh">Refresh</button>
        </div>
      </div>

      <div class="panel">
        <div class="timeline" id="timeline">
          <div class="line"></div>
          <!-- nodes will be injected here -->
        </div>

        <div class="detail" id="detail">
          <div class="title">Snapshot details</div>
          <div class="subtitle">Select a snapshot to view details, diff, or restore.</div>
          <div id="detail-body"></div>
        </div>
      </div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const payload = ${initialPayload};
      let metas = payload.metas || [];

      function formatDate(iso){
        try{
          return new Date(iso).toLocaleString();
        }catch(e){ return iso; }
      }

      function makePreview(meta){
        // small preview text placeholder (we don't have content)
        return meta.scope === 'snippet' ? 'Snippet snapshot' : 'Full file snapshot';
      }

      function renderTimeline(){
        const t = document.getElementById('timeline');
        t.querySelectorAll('.node-wrap').forEach(n => n.remove());

        metas.forEach((m, idx) => {
          const wrap = document.createElement('div');
          wrap.className = 'node-wrap';

          const icon = document.createElement('div');
          icon.className = 'node-icon';
          icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="rgba(255,255,255,0.02)"/><circle cx="12" cy="9" r="3.5" fill="url(#g)"/><path d="M7 17c1.5-2 5-2 7 0" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" stroke-linecap="round"/></svg>';

          const card = document.createElement('div');
          card.className = 'node-card';

          const metaRow = document.createElement('div');
          metaRow.className = 'meta';

          const lbl = document.createElement('div');
          lbl.className = 'label';
          lbl.textContent = m.label || m.id;

          const when = document.createElement('div');
          when.className = 'time';
          when.textContent = formatDate(m.createdAt);

          metaRow.appendChild(lbl);
          metaRow.appendChild(when);

          const badges = document.createElement('div');
          badges.className = 'badges';
          const b1 = document.createElement('div');
          b1.className = 'badge';
          b1.textContent = m.scope === 'snippet' ? 'SNIPPET' : 'FILE';
          badges.appendChild(b1);

          const preview = document.createElement('div');
          preview.className = 'card-preview';
          preview.textContent = makePreview(m);

          const actionsRow = document.createElement('div');
          actionsRow.className = 'actions-row';
          const btnDiff = document.createElement('button');
          btnDiff.className = 'action-btn';
          btnDiff.textContent = 'Diff';
          btnDiff.onclick = () => post('diff', m.id);

          const btnRestore = document.createElement('button');
          btnRestore.className = 'action-btn';
          btnRestore.textContent = 'Restore';
          btnRestore.onclick = () => post('restore', m.id);

          const btnDelete = document.createElement('button');
          btnDelete.className = 'action-btn ghost';
          btnDelete.textContent = 'Delete';
          btnDelete.onclick = () => {
            if (confirm('Delete this snapshot?')) post('deleteSnapshot', m.id);
          };

          actionsRow.appendChild(btnDiff);
          actionsRow.appendChild(btnRestore);
          actionsRow.appendChild(btnDelete);

          card.appendChild(metaRow);
          card.appendChild(badges);
          card.appendChild(preview);
          card.appendChild(actionsRow);

          // dot connector
          const dot = document.createElement('div');
          dot.className = 'dot';

          wrap.appendChild(icon);
          wrap.appendChild(card);
          wrap.appendChild(dot);

          // hover -> show details in detail pane
          card.addEventListener('mouseenter', () => showDetail(m));
          card.addEventListener('click', () => {
            // small click effect
            card.style.boxShadow = '0 24px 64px rgba(2,6,23,0.8)';
            setTimeout(()=>card.style.boxShadow='', 500);
            showDetail(m);
          });

          t.appendChild(wrap);
        });
      }

      function showDetail(m){
        const detail = document.getElementById('detail-body');
        detail.innerHTML = '';
        const h = document.createElement('div');
        h.innerHTML = \`<div style="font-weight:700;margin-bottom:6px">\${m.label}</div>\`;
        const info = document.createElement('div');
        info.className = 'subtitle';
        info.textContent = 'Created: ' + formatDate(m.createdAt) + ' — Scope: ' + m.scope;
        const actions = document.createElement('div');
        actions.style.marginTop = '12px';
        actions.innerHTML = '<button class="btn primary" id="d-diff">Diff</button> <button class="btn" id="d-restore">Restore</button> <button class="btn" id="d-delete">Delete</button>';

        detail.appendChild(h);
        detail.appendChild(info);
        detail.appendChild(actions);

        document.getElementById('d-diff').onclick = () => post('diff', m.id);
        document.getElementById('d-restore').onclick = () => {
          if (confirm('Restore this snapshot into editor?')) post('restore', m.id);
        };
        document.getElementById('d-delete').onclick = () => {
          if (confirm('Delete this snapshot?')) post('deleteSnapshot', m.id);
        };
      }

      function post(type, id) {
        vscode.postMessage({ type, id });
      }

      // wire header buttons
      document.getElementById('refresh').addEventListener('click', () => {
        vscode.postMessage({ type: 'refreshRequest' }); // host may ignore; we maintain host-driven refresh
      });

      document.getElementById('delete-all').addEventListener('click', () => {
        if (confirm('Delete ALL snapshots for this file?')) {
          vscode.postMessage({ type: 'deleteFile' });
        }
      });

      document.getElementById('create-snippet').addEventListener('click', () => {
        vscode.postMessage({ type: 'createSnippetFromSelection' });
      });

      // initial render
      renderTimeline();

      // receive host messages (refresh)
      window.addEventListener('message', event => {
        const m = event.data;
        if (m.type === 'refresh') {
          metas = m.metas || [];
          renderTimeline();
          // clear detail
          document.getElementById('detail-body').innerHTML = '<div class="subtitle">Select a snapshot to view details.</div>';
        }
      });

    </script>
  </body>
  </html>
  `;
}
function registerSplitTimeline(context) {
    const openSplitTimelineCmd = vscode.commands.registerCommand("snapshotter.openSplitTimeline3D", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return vscode.window.showErrorMessage("Open a file first to view its timeline.");
        }
        const document = editor.document;
        if (document.isUntitled) {
            return vscode.window.showErrorMessage("Save the file first to use the timeline.");
        }
        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspace)
            return;
        // Load snapshot metadata for this file
        const relPath = path.relative(workspace.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
        const metas = (0, snapshotStore_1.listSnapshots)(workspace, relPath);
        const panel = vscode.window.createWebviewPanel("snapshotterTimeline3D", `Snapshot Timeline — ${path.basename(document.fileName)}`, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false }, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(context.extensionPath)],
        });
        // Provide initial HTML
        panel.webview.html = getTimelineWebviewHTML(panel.webview, context.extensionPath, metas, path.basename(document.fileName));
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (msg) => {
            try {
                if (!msg || !msg.type)
                    return;
                if (msg.type === "restore") {
                    const snap = (0, snapshotService_1.loadSnapshotForDocument)(document, msg.id);
                    if (!snap)
                        return vscode.window.showErrorMessage("Snapshot not found.");
                    const confirm = await vscode.window.showWarningMessage("Restore this snapshot into editor?", { modal: true }, "Restore");
                    if (confirm === "Restore") {
                        const editor2 = vscode.window.activeTextEditor;
                        if (!editor2)
                            return vscode.window.showErrorMessage("No active editor to restore into.");
                        await (0, snapshotService_1.restoreSnapshotIntoEditor)(editor2, snap);
                        vscode.window.showInformationMessage("Snapshot restored.");
                    }
                    return;
                }
                if (msg.type === "diff") {
                    const snap = (0, snapshotService_1.loadSnapshotForDocument)(document, msg.id);
                    if (!snap)
                        return vscode.window.showErrorMessage("Snapshot not found.");
                    await openDiffForSnapshot(document, snap.meta, snap.content);
                    return;
                }
                if (msg.type === "deleteSnapshot") {
                    const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (!workspace)
                        return;
                    const rel = path.relative(workspace.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
                    (0, snapshotStore_1.deleteSnapshotFile)(workspace, rel, msg.id);
                    vscode.window.showInformationMessage("Snapshot deleted.");
                    // refresh list and send to webview
                    const newList = (0, snapshotStore_1.listSnapshots)(workspace, rel);
                    panel.webview.postMessage({ type: "refresh", metas: newList });
                    return;
                }
                if (msg.type === "deleteFile") {
                    const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (!workspace)
                        return;
                    const rel = path.relative(workspace.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
                    (0, snapshotStore_1.deleteSnapshotFolder)(workspace, rel);
                    vscode.window.showInformationMessage("All snapshots for this file deleted.");
                    panel.webview.postMessage({ type: "refresh", metas: [] });
                    return;
                }
                if (msg.type === "createSnippetFromSelection") {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor)
                        return vscode.window.showErrorMessage("No active editor.");
                    if (editor.selection.isEmpty)
                        return vscode.window.showErrorMessage("No selection to snapshot.");
                    const label = await vscode.window.showInputBox({ prompt: "Label for snippet snapshot", value: "Snippet" });
                    const snap = await (0, snapshotService_1.createSnapshotForEditor)(editor, "snippet", label || undefined);
                    if (snap) {
                        vscode.window.showInformationMessage("Snippet snapshot created.");
                        // refresh list and send to webview
                        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
                        if (!workspace)
                            return;
                        const rel = path.relative(workspace.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
                        const newList = (0, snapshotStore_1.listSnapshots)(workspace, rel);
                        panel.webview.postMessage({ type: "refresh", metas: newList });
                    }
                    return;
                }
            }
            catch (err) {
                console.error("webview message handler error:", err);
                vscode.window.showErrorMessage("Action failed. Check console for details.");
            }
        });
        // When panel becomes visible again, you can refresh if needed
        panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
                if (workspace) {
                    const rel = path.relative(workspace.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
                    const newList = (0, snapshotStore_1.listSnapshots)(workspace, rel);
                    panel.webview.postMessage({ type: "refresh", metas: newList });
                }
            }
        });
    });
    context.subscriptions.push(openSplitTimelineCmd);
}
