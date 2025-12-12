import * as vscode from "vscode";
import * as fs from "fs";
import {
    Snapshot,
    SnapshotMeta,
    SnapshotScope,
    SnippetRange,
} from "./snapshotTypes";
import {
    getWorkspaceFolderForUri,
    getRelativePath,
    saveSnapshot,
    listSnapshots as storageListSnapshots,
    loadSnapshot as storageLoadSnapshot,
} from "./snapshotStore";

function nowId(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
}



export async function createSnapshotForEditor(
    editor: vscode.TextEditor,
    scope: SnapshotScope,
    label?: string,
    parentId?: string | null
): Promise<Snapshot | undefined> {
    const document = editor.document;

    if (document.isUntitled) {
        vscode.window.showErrorMessage("Cannot snapshot an unsaved file.");
        return;
    }

    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) {
        vscode.window.showErrorMessage("File is not inside a workspace.");
        return;
    }

    let content: string;
    let snippetRange: SnippetRange | undefined;

    if (scope === "snippet" && !editor.selection.isEmpty) {
        const sel = editor.selection;
        content = document.getText(sel);
        snippetRange = {
            startLine: sel.start.line,
            startCharacter: sel.start.character,
            endLine: sel.end.line,
            endCharacter: sel.end.character,
        };
    } else {
        // 🔥 ALWAYS read full file from disk for reliability
        content = fs.readFileSync(document.uri.fsPath, "utf8");
    }

    const relPath = getRelativePath(workspace, document.uri);
    const id = nowId();

    const meta: SnapshotMeta = {
        id,
        filePath: relPath,
        createdAt: new Date().toISOString(),
        scope: snippetRange ? "snippet" : "file",
        label,
        snippetRange,
        parentId: parentId ?? null,
        engineVersion: 2
    };

    const snapshot: Snapshot = { meta, content };
    saveSnapshot(workspace, snapshot);
    return snapshot;
}

export function listSnapshotsForDocument(
    document: vscode.TextDocument
): SnapshotMeta[] {
    if (document.isUntitled) return [];
    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) return [];
    const relPath = getRelativePath(workspace, document.uri);
    return storageListSnapshots(workspace, relPath);
}

export function loadSnapshotForDocument(
    document: vscode.TextDocument,
    id: string
): Snapshot | undefined {
    if (document.isUntitled) return;
    const workspace = getWorkspaceFolderForUri(document.uri);
    if (!workspace) return;
    const relPath = getRelativePath(workspace, document.uri);
    return storageLoadSnapshot(workspace, relPath, id);
}

export async function restoreSnapshotIntoEditor(
    editor: vscode.TextEditor,
    snapshot: Snapshot
): Promise<void> {

    const document = editor.document;

    await editor.edit((builder) => {
        if (snapshot.meta.scope === "file") {
            // full file range
            const lastLine = document.lineCount - 1;
            const lastChar = document.lineAt(lastLine).range.end.character;
            const fullRange = new vscode.Range(0, 0, lastLine, lastChar);
            builder.replace(fullRange, snapshot.content);

        } else if (snapshot.meta.scope === "snippet" && snapshot.meta.snippetRange) {
            const r = snapshot.meta.snippetRange;
            const range = new vscode.Range(
                r.startLine,
                r.startCharacter,
                r.endLine,
                r.endCharacter
            );
            builder.replace(range, snapshot.content);
        }
    });
}
