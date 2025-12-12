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
exports.createSnapshotForEditor = createSnapshotForEditor;
exports.listSnapshotsForFile = listSnapshotsForFile;
exports.loadSnapshot = loadSnapshot;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function getWorkspaceFolderForUri(uri) {
    return vscode.workspace.getWorkspaceFolder(uri);
}
function getRelativePath(workspace, uri) {
    return path.relative(workspace.uri.fsPath, uri.fsPath);
}
function getSnapshotRoot(workspace) {
    return path.join(workspace.uri.fsPath, ".vscode-snapshots");
}
function ensureDirExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function getSnapshotDirForFile(workspace, fileRelativePath) {
    const safePath = fileRelativePath.replace(/[/\\]/g, "__");
    return path.join(getSnapshotRoot(workspace), safePath);
}
function getSnapshotFilePath(snapshotDir, id) {
    return path.join(snapshotDir, `${id}.json`);
}
async function createSnapshotForEditor(editor, scope = "file", label) {
    const document = editor.document;
    if (document.isUntitled) {
        void vscode.window.showErrorMessage("Cannot snapshot an unsaved/untitled file.");
        return;
    }
    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) {
        void vscode.window.showErrorMessage("File is not inside a workspace folder.");
        return;
    }
    const content = scope === "file"
        ? document.getText()
        : document.getText(editor.selection.isEmpty ? new vscode.Range(0, 0, document.lineCount, 0) : editor.selection);
    const relPath = getRelativePath(workspace, document.uri);
    const snapshotDir = getSnapshotDirForFile(workspace, relPath);
    ensureDirExists(snapshotDir);
    const id = new Date().toISOString().replace(/[:.]/g, "-");
    const meta = {
        id,
        filePath: relPath,
        createdAt: new Date().toISOString(),
        scope,
    };
    if (scope === "snippet" && !editor.selection.isEmpty) {
        const sel = editor.selection;
        meta.snippetRange = {
            startLine: sel.start.line,
            startCharacter: sel.start.character,
            endLine: sel.end.line,
            endCharacter: sel.end.character,
        };
    }
    if (label) {
        meta.label = label;
    }
    const snapshot = {
        meta,
        content,
    };
    const filePath = getSnapshotFilePath(snapshotDir, id);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
    return snapshot;
}
async function listSnapshotsForFile(document) {
    if (document.isUntitled) {
        return [];
    }
    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) {
        return [];
    }
    const relPath = getRelativePath(workspace, document.uri);
    const snapshotDir = getSnapshotDirForFile(workspace, relPath);
    if (!fs.existsSync(snapshotDir)) {
        return [];
    }
    const files = fs.readdirSync(snapshotDir).filter((f) => f.endsWith(".json"));
    const metas = [];
    for (const file of files) {
        try {
            const full = path.join(snapshotDir, file);
            const json = JSON.parse(fs.readFileSync(full, "utf8"));
            metas.push(json.meta);
        }
        catch {
            // ignore corrupted
        }
    }
    // sort newest first
    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return metas;
}
async function loadSnapshot(document, id) {
    if (document.isUntitled) {
        return;
    }
    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) {
        return;
    }
    const relPath = getRelativePath(workspace, document.uri);
    const snapshotDir = getSnapshotDirForFile(workspace, relPath);
    const filePath = getSnapshotFilePath(snapshotDir, id);
    if (!fs.existsSync(filePath)) {
        return;
    }
    try {
        const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return json;
    }
    catch {
        return;
    }
}
