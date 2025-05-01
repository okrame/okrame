export interface CacheInstance {
    edges: { [key: string]: EdgeInfo };
    languages?: LanguageStats;
}

export interface Edge {
    node: any
}

export interface EdgeInfo {
    additions: number;
    deletions: number;
    commits: number;
    totalCommits: number;
    languages?: { [name: string]: number };
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
    languages: LanguageStats;
}

export interface LanguageStats {
    [name: string]: number;
}
