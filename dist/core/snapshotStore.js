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
exports.getWorkspaceFolderForUri = getWorkspaceFolderForUri;
exports.getRelativePath = getRelativePath;
exports.getSnapshotRoot = getSnapshotRoot;
exports.getSnapshotDirForFile = getSnapshotDirForFile;
exports.saveSnapshot = saveSnapshot;
exports.listSnapshots = listSnapshots;
exports.loadSnapshot = loadSnapshot;
exports.deleteSnapshotFile = deleteSnapshotFile;
exports.deleteSnapshotFolder = deleteSnapshotFolder;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function getWorkspaceFolderForUri(uri) {
    return vscode.workspace.getWorkspaceFolder(uri);
}
function getRelativePath(workspace, uri) {
    return path.relative(workspace.uri.fsPath, uri.fsPath);
}
function getSnapshotRoot(workspace) {
    return path.join(workspace.uri.fsPath, ".vscode-snapshots");
}
function getSnapshotDirForFile(workspace, fileRelativePath) {
    const safePath = fileRelativePath.replace(/[/\\]/g, "__");
    return path.join(getSnapshotRoot(workspace), safePath);
}
function saveSnapshot(workspace, snapshot) {
    const snapshotDir = getSnapshotDirForFile(workspace, snapshot.meta.filePath);
    ensureDir(snapshotDir);
    const filePath = path.join(snapshotDir, `${snapshot.meta.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}
function listSnapshots(workspace, relPath) {
    const dir = getSnapshotDirForFile(workspace, relPath);
    if (!fs.existsSync(dir))
        return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    const metas = [];
    for (const fName of files) {
        const full = path.join(dir, fName);
        try {
            const json = JSON.parse(fs.readFileSync(full, "utf8"));
            metas.push(json.meta);
        }
        catch {
            // ignore bad/corrupt
        }
    }
    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
    return metas;
}
function loadSnapshot(workspace, relPath, id) {
    const dir = getSnapshotDirForFile(workspace, relPath);
    const filePath = path.join(dir, `${id}.json`);
    if (!fs.existsSync(filePath))
        return;
    try {
        const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return json;
    }
    catch {
        return;
    }
}
function deleteSnapshotFile(workspace, relPath, snapshotId) {
    const dir = getSnapshotDirForFile(workspace, relPath);
    const file = path.join(dir, `${snapshotId}.json`);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}
function deleteSnapshotFolder(workspace, relPath) {
    const dir = getSnapshotDirForFile(workspace, relPath);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
