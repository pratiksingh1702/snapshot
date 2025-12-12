import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type SnapshotScope = "file" | "snippet";

export interface SnapshotMeta {
    id: string;
    filePath: string; // workspace-relative path
    createdAt: string; // ISO string
    scope: SnapshotScope;
    snippetRange?: {
        startLine: number;
        startCharacter: number;
        endLine: number;
        endCharacter: number;
    };
    label?: string;
}

export interface Snapshot {
    meta: SnapshotMeta;
    content: string;
}

function getWorkspaceFolderForUri(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(uri);
}

function getRelativePath(workspace: vscode.WorkspaceFolder, uri: vscode.Uri): string {
    return path.relative(workspace.uri.fsPath, uri.fsPath);
}

function getSnapshotRoot(workspace: vscode.WorkspaceFolder): string {
    return path.join(workspace.uri.fsPath, ".vscode-snapshots");
}

function ensureDirExists(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function getSnapshotDirForFile(workspace: vscode.WorkspaceFolder, fileRelativePath: string): string {
    const safePath = fileRelativePath.replace(/[/\\]/g, "__");
    return path.join(getSnapshotRoot(workspace), safePath);
}

function getSnapshotFilePath(snapshotDir: string, id: string): string {
    return path.join(snapshotDir, `${id}.json`);
}

export async function createSnapshotForEditor(
    editor: vscode.TextEditor,
    scope: SnapshotScope = "file",
    label?: string
): Promise<Snapshot | undefined> {
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

    const content =
        scope === "file"
            ? document.getText()
            : document.getText(editor.selection.isEmpty ? new vscode.Range(0, 0, document.lineCount, 0) : editor.selection);

    const relPath = getRelativePath(workspace, document.uri);
    const snapshotDir = getSnapshotDirForFile(workspace, relPath);
    ensureDirExists(snapshotDir);

    const id = new Date().toISOString().replace(/[:.]/g, "-");
    const meta: SnapshotMeta = {
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

    const snapshot: Snapshot = {
        meta,
        content,
    };

    const filePath = getSnapshotFilePath(snapshotDir, id);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");

    return snapshot;
}

export async function listSnapshotsForFile(
    document: vscode.TextDocument
): Promise<SnapshotMeta[]> {
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
    const metas: SnapshotMeta[] = [];

    for (const file of files) {
        try {
            const full = path.join(snapshotDir, file);
            const json = JSON.parse(fs.readFileSync(full, "utf8")) as Snapshot;
            metas.push(json.meta);
        } catch {
            // ignore corrupted
        }
    }

    // sort newest first
    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return metas;
}

export async function loadSnapshot(
    document: vscode.TextDocument,
    id: string
): Promise<Snapshot | undefined> {
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
        const json = JSON.parse(fs.readFileSync(filePath, "utf8")) as Snapshot;
        return json;
    } catch {
        return;
    }
}
