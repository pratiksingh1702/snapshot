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
exports.listSnapshotsForDocument = listSnapshotsForDocument;
exports.loadSnapshotForDocument = loadSnapshotForDocument;
exports.restoreSnapshotIntoEditor = restoreSnapshotIntoEditor;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const snapshotStore_1 = require("./snapshotStore");
function nowId() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
async function createSnapshotForEditor(editor, scope, label, parentId) {
    const document = editor.document;
    if (document.isUntitled) {
        vscode.window.showErrorMessage("Cannot snapshot an unsaved file.");
        return;
    }
    const workspace = (0, snapshotStore_1.getWorkspaceFolderForUri)(document.uri);
    if (!workspace) {
        vscode.window.showErrorMessage("File is not inside a workspace.");
        return;
    }
    let content;
    let snippetRange;
    if (scope === "snippet" && !editor.selection.isEmpty) {
        const sel = editor.selection;
        content = document.getText(sel);
        snippetRange = {
            startLine: sel.start.line,
            startCharacter: sel.start.character,
            endLine: sel.end.line,
            endCharacter: sel.end.character,
        };
    }
    else {
        // 🔥 ALWAYS read full file from disk for reliability
        content = fs.readFileSync(document.uri.fsPath, "utf8");
    }
    const relPath = (0, snapshotStore_1.getRelativePath)(workspace, document.uri);
    const id = nowId();
    const meta = {
        id,
        filePath: relPath,
        createdAt: new Date().toISOString(),
        scope: snippetRange ? "snippet" : "file",
        label,
        snippetRange,
        parentId: parentId ?? null,
        engineVersion: 2
    };
    const snapshot = { meta, content };
    (0, snapshotStore_1.saveSnapshot)(workspace, snapshot);
    return snapshot;
}
function listSnapshotsForDocument(document) {
    if (document.isUntitled)
        return [];
    const workspace = (0, snapshotStore_1.getWorkspaceFolderForUri)(document.uri);
    if (!workspace)
        return [];
    const relPath = (0, snapshotStore_1.getRelativePath)(workspace, document.uri);
    return (0, snapshotStore_1.listSnapshots)(workspace, relPath);
}
function loadSnapshotForDocument(document, id) {
    if (document.isUntitled)
        return;
    const workspace = (0, snapshotStore_1.getWorkspaceFolderForUri)(document.uri);
    if (!workspace)
        return;
    const relPath = (0, snapshotStore_1.getRelativePath)(workspace, document.uri);
    return (0, snapshotStore_1.loadSnapshot)(workspace, relPath, id);
}
async function restoreSnapshotIntoEditor(editor, snapshot) {
    const document = editor.document;
    await editor.edit((builder) => {
        if (snapshot.meta.scope === "file") {
            // full file range
            const lastLine = document.lineCount - 1;
            const lastChar = document.lineAt(lastLine).range.end.character;
            const fullRange = new vscode.Range(0, 0, lastLine, lastChar);
            builder.replace(fullRange, snapshot.content);
        }
        else if (snapshot.meta.scope === "snippet" && snapshot.meta.snippetRange) {
            const r = snapshot.meta.snippetRange;
            const range = new vscode.Range(r.startLine, r.startCharacter, r.endLine, r.endCharacter);
            builder.replace(range, snapshot.content);
        }
    });
}
