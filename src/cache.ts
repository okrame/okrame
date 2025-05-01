import { createHash } from "crypto";
import { isEdgeInfoEntry } from "./utils";
import { getRepoInfo } from "./queries";
import { readFileSync } from "fs"
import { CacheInstance, Edge, EdgeInfo, LanguageStats } from "./types";

export async function handleEdgesUpdate(userId: string, cache: CacheInstance, edges: Edge[]) {
    if (!cache.languages) {
        cache.languages = {};
    }

    for (var e of edges) {
        // Skip fork repositories created before June 2024
        const isFork = e.node.isFork || false;
        const createdAt = e.node.createdAt ? new Date(e.node.createdAt) : new Date();
        const isRecentFork = (createdAt.getFullYear() > 2024) || 
                             (createdAt.getFullYear() === 2024 && createdAt.getMonth() >= 5); // Giugno è il mese 5 (0-based index)
        
        if (isFork && !isRecentFork) {
            console.log(`Skipping old fork: ${e.node.nameWithOwner} (created: ${createdAt.toISOString().split('T')[0]})`);
            continue;
        }

        const key = createHash('sha256').update(e.node.nameWithOwner).update(process.env.SALT ? process.env.SALT : "").digest('hex')
        if (
            (
                // Skip caching if repo is empty
                e.node.defaultBranchRef == null ||
                // Skip caching if repo has no commits in the default branch
                e.node.defaultBranchRef.target == null
            )
            ||
            (
                cache.edges.hasOwnProperty(key) &&
                isEdgeInfoEntry(cache.edges[key]) &&
                // Check if total commits count has changed if the repo has commits in the default branch
                cache.edges[key].totalCommits == e.node.defaultBranchRef.target.history.totalCount
            )
        ) {
            // Repo is already cached or has no commits or is empty
            // Still process languages if available
            if (e.node.languages && e.node.languages.edges && e.node.languages.edges.length > 0) {
                processLanguages(cache.languages, e.node.languages.edges);
            }
            continue
        } else {
            try {
                // Repo is not cached or needs update
                const ownerAndName = e.node.nameWithOwner.split("/")
                const repoInfo: EdgeInfo = await getRepoInfo(
                    ownerAndName[1],
                    ownerAndName[0],
                    userId,
                    undefined,
                    0,
                    0,
                    0
                )
                cache.edges[key] = repoInfo
                
                // Add languages from this repo to the global languages count
                if (repoInfo.languages) {
                    for (const [lang, size] of Object.entries(repoInfo.languages)) {
                        cache.languages[lang] = (cache.languages[lang] || 0) + size;
                    }
                }
            } catch (error) {
                let message = 'Unknown Error'
                if (error instanceof Error) message = error.message
                console.log(`An error occurred while caching values for ${key}: ${message}. This edge will be skipped`)
            }
        }
    }
}

function processLanguages(languages: LanguageStats, langEdges: any[]) {
    for (const edge of langEdges) {
        // Convert Jupyter Notebook to Python
        let langName = edge.node.name;
        if (langName === "Jupyter Notebook") {
            langName = "Python";
        }
        
        languages[langName] = (languages[langName] || 0) + edge.size;
    }
}

export async function buildCache(userId: string, edges: Edge[]): Promise<CacheInstance> {

    var cache: CacheInstance;

    if (process.env.FLUSH_CACHE == "true") {
        // Flush cache
        cache = { edges: {}, languages: {} }
    } else {
        // Try to load cache
        try {
            const data = readFileSync(process.env.CACHE_FILE)
            cache = JSON.parse(data.toString())
            if (!cache.languages) {
                cache.languages = {};
            }
        } catch (error) {
            cache = { edges: {}, languages: {} }
        }
    }

    await handleEdgesUpdate(userId, cache, edges)
    return cache
}