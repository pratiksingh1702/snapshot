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
exports.TimelineNode = exports.TimelineProvider = void 0;
const vscode = __importStar(require("vscode"));
const snapshotStore_1 = require("../core/snapshotStore");
const path = __importStar(require("path"));
class TimelineProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders)
            return [];
        // Root → show all files that have snapshots
        if (!element) {
            return this.getFileNodes();
        }
        // File node → list snapshots
        if (element.type === "file") {
            return this.getSnapshotNodes(element.filePath);
        }
        return [];
    }
    async getFileNodes() {
        const result = [];
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const workspacePath = folder.uri.fsPath;
            const allFiles = await vscode.workspace.findFiles("**/*");
            for (const f of allFiles) {
                const relPath = path.relative(workspacePath, f.fsPath);
                const metas = (0, snapshotStore_1.listSnapshots)(folder, relPath);
                if (metas.length > 0) {
                    result.push(new TimelineNode(f.fsPath, "file"));
                }
            }
        }
        return result;
    }
    async getSnapshotNodes(filePath) {
        const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspace)
            return [];
        const relPath = path.relative(workspace.uri.fsPath, filePath);
        const snapshots = (0, snapshotStore_1.listSnapshots)(workspace, relPath);
        return snapshots.map((meta) => new TimelineNode(filePath, "snapshot", meta));
    }
}
exports.TimelineProvider = TimelineProvider;
class TimelineNode extends vscode.TreeItem {
    constructor(filePath, type, snapshot) {
        super(type === "file"
            ? path.basename(filePath)
            : `• ${snapshot?.label || snapshot?.id}`, type === "file"
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.filePath = filePath;
        this.type = type;
        this.snapshot = snapshot;
        this.contextValue = type === "file" ? "fileNode" : "snapshot";
        if (type === "snapshot") {
            this.description = new Date(snapshot.createdAt).toLocaleString();
        }
    }
}
exports.TimelineNode = TimelineNode;
