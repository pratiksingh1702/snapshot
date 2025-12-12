import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Snapshot, SnapshotMeta } from "./snapshotTypes";

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function getWorkspaceFolderForUri(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(uri);
}

export function getRelativePath(workspace: vscode.WorkspaceFolder, uri: vscode.Uri): string {
    return path.relative(workspace.uri.fsPath, uri.fsPath);
}

export function getSnapshotRoot(workspace: vscode.WorkspaceFolder): string {
    return path.join(workspace.uri.fsPath, ".vscode-snapshots");
}

export function getSnapshotDirForFile(workspace: vscode.WorkspaceFolder, fileRelativePath: string): string {
    const safePath = fileRelativePath.replace(/[/\\]/g, "__");
    return path.join(getSnapshotRoot(workspace), safePath);
}

export function saveSnapshot(workspace: vscode.WorkspaceFolder, snapshot: Snapshot): void {
    const snapshotDir = getSnapshotDirForFile(workspace, snapshot.meta.filePath);
    ensureDir(snapshotDir);
    const filePath = path.join(snapshotDir, `${snapshot.meta.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}

export function listSnapshots(workspace: vscode.WorkspaceFolder, relPath: string): SnapshotMeta[] {
    const dir = getSnapshotDirForFile(workspace, relPath);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    const metas: SnapshotMeta[] = [];

    for (const fName of files) {
        const full = path.join(dir, fName);
        try {
            const json = JSON.parse(fs.readFileSync(full, "utf8")) as Snapshot;
            metas.push(json.meta);
        } catch {
            // ignore bad/corrupt
        }
    }

    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
    return metas;
}

export function loadSnapshot(workspace: vscode.WorkspaceFolder, relPath: string, id: string): Snapshot | undefined {
    const dir = getSnapshotDirForFile(workspace, relPath);
    const filePath = path.join(dir, `${id}.json`);
    if (!fs.existsSync(filePath)) return;

    try {
        const json = JSON.parse(fs.readFileSync(filePath, "utf8")) as Snapshot;
        return json;
    } catch {
        return;
    }
}
export function deleteSnapshotFile(workspace: vscode.WorkspaceFolder, relPath: string, snapshotId: string): void {
    const dir = getSnapshotDirForFile(workspace, relPath);
    const file = path.join(dir, `${snapshotId}.json`);

    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

export function deleteSnapshotFolder(workspace: vscode.WorkspaceFolder, relPath: string): void {
    const dir = getSnapshotDirForFile(workspace, relPath);

    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
