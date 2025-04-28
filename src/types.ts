export interface CacheInstance {
    edges: { [key: string]: EdgeInfo };
}

export interface Edge {
    node: any
}

export interface EdgeInfo {
    additions: number;
    deletions: number;
    commits: number;
    totalCommits: number;
}

export interface UserInfo {
    id: string;
    createdAt: string;
}

export interface Stats {
    accountAge: number;
    repoCount: number;
    commits: number;
    additions: number;
    deletions: number;
}
