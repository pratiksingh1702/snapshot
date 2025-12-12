import * as vscode from "vscode";
import { listSnapshots, deleteSnapshotFile, deleteSnapshotFolder } from "../core/snapshotStore";
import { SnapshotMeta } from "../core/snapshotTypes";
import * as path from "path";

export class TimelineProvider implements vscode.TreeDataProvider<TimelineNode> {

    private _onDidChangeTreeData = new vscode.EventEmitter<TimelineNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TimelineNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TimelineNode): Promise<TimelineNode[]> {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return [];

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

    private async getFileNodes(): Promise<TimelineNode[]> {
        const result: TimelineNode[] = [];

        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const workspacePath = folder.uri.fsPath;
            const allFiles = await vscode.workspace.findFiles("**/*");

            for (const f of allFiles) {
                const relPath = path.relative(workspacePath, f.fsPath);
                const metas = listSnapshots(folder, relPath);

                if (metas.length > 0) {
                    result.push(new TimelineNode(f.fsPath, "file"));
                }
            }
        }

        return result;
    }

    private async getSnapshotNodes(filePath: string): Promise<TimelineNode[]> {
        const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspace) return [];

        const relPath = path.relative(workspace.uri.fsPath, filePath);
        const snapshots = listSnapshots(workspace, relPath);

        return snapshots.map((meta) => new TimelineNode(filePath, "snapshot", meta));
    }
}

export class TimelineNode extends vscode.TreeItem {

    constructor(
        public filePath: string,
        public type: "file" | "snapshot",
        public snapshot?: SnapshotMeta
    ) {
        super(
            type === "file"
                ? path.basename(filePath)
                : `• ${snapshot?.label || snapshot?.id}`,
            type === "file"
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.contextValue = type === "file" ? "fileNode" : "snapshot";

        if (type === "snapshot") {
            this.description = new Date(snapshot!.createdAt).toLocaleString();
        }
    }
}
