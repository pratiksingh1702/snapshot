export type SnapshotScope = "file" | "snippet";

export interface SnippetRange {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
}

export interface SnapshotMeta {
    id: string;                 // unique id, timestamp-based
    filePath: string;           // workspace-relative path
    createdAt: string;          // ISO datetime
    scope: SnapshotScope;
    label?: string;
    snippetRange?: SnippetRange;
    parentId?: string | null;   // for future branching/experiments
    engineVersion: number;      // schema version
}

export interface Snapshot {
    meta: SnapshotMeta;
    content: string;
}
