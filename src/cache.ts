import { createHash } from "crypto";
import { isEdgeInfoEntry } from "./utils";
import { getRepoInfo } from "./queries";
import { readFileSync } from "fs"
import { CacheInstance, Edge, EdgeInfo } from "./types";

export async function handleEdgesUpdate(userId: string, cache: CacheInstance, edges: Edge[]) {
    for (var e of edges) {
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
            } catch (error) {
                let message = 'Unknown Error'
                if (error instanceof Error) message = error.message
                console.log(`An error occurred while caching values for ${key}: ${message}. This edge will be skipped`)
            }
        }
    }
}

export async function buildCache(userId: string, edges: Edge[]): Promise<CacheInstance> {

    var cache: CacheInstance;

    if (process.env.FLUSH_CACHE == "true") {
        // Flush cache
        cache = { edges: {} }
    } else {
        // Try to load cache
        try {
            const data = readFileSync(process.env.CACHE_FILE)
            cache = JSON.parse(data.toString())
        } catch (error) {
            cache = { edges: {} }
        }
    }

    await handleEdgesUpdate(userId, cache, edges)
    return cache
}