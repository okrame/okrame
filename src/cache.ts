import { createHash } from "crypto";
import { isEdgeInfoEntry } from "./utils";
import { getRepoInfo } from "./queries";
import { readFileSync } from "fs";
import { CacheInstance, Edge, EdgeInfo, LanguageStats } from "./types";

export async function handleEdgesUpdate(
  userId: string,
  cache: CacheInstance,
  edges: Edge[]
) {
  if (!cache.languages) {
    cache.languages = {};
  }

  for (var e of edges) {
    const isFork = e.node.isFork || false;
    const createdAt = e.node.createdAt
      ? new Date(e.node.createdAt)
      : new Date();
    const isRecentFork =
      createdAt.getFullYear() > 2024 ||
      (createdAt.getFullYear() === 2024 && createdAt.getMonth() >= 5);

    if (isFork && !isRecentFork) {
      console.log(
        `Skipping old fork: ${e.node.nameWithOwner} (created: ${
          createdAt.toISOString().split("T")[0]
        })`
      );
      continue;
    }

    const key = createHash("sha256")
      .update(e.node.nameWithOwner)
      .update(process.env.SALT ? process.env.SALT : "")
      .digest("hex");
    if (
      e.node.defaultBranchRef == null ||
      e.node.defaultBranchRef.target == null ||
      (cache.edges.hasOwnProperty(key) &&
        isEdgeInfoEntry(cache.edges[key]) &&
        cache.edges[key].totalCommits ==
          e.node.defaultBranchRef.target.history.totalCount)
    ) {
      if (
        e.node.languages &&
        e.node.languages.edges &&
        e.node.languages.edges.length > 0
      ) {
        processLanguages(cache.languages, e.node.languages.edges);
      }
      continue;
    } else {
      try {
        const ownerAndName = e.node.nameWithOwner.split("/");
        const repoInfo: EdgeInfo = await getRepoInfo(
          ownerAndName[1],
          ownerAndName[0],
          userId,
          undefined,
          0,
          0,
          0
        );
        cache.edges[key] = repoInfo;

        if (repoInfo.languages) {
          for (const [lang, size] of Object.entries(repoInfo.languages)) {
            cache.languages[lang] = (cache.languages[lang] || 0) + size;
          }
        }
      } catch (error) {
        let message = "Unknown Error";
        if (error instanceof Error) message = error.message;
        console.log(
          `An error occurred while caching values for ${key}: ${message}. This edge will be skipped`
        );
      }
    }
  }
}

function processLanguages(languages: LanguageStats, langEdges: any[]) {
  for (const edge of langEdges) {
    let langName = edge.node.name;

    if (langName === "Jupyter Notebook") langName = "Python";

    if (langName === "HTML") continue;

    languages[langName] = (languages[langName] || 0) + edge.size;
  }
}

export async function buildCache(
  userId: string,
  edges: Edge[]
): Promise<CacheInstance> {
  var cache: CacheInstance;

  if (process.env.FLUSH_CACHE == "true") {
    cache = { edges: {}, languages: {} };
  } else {
    try {
      const data = readFileSync(process.env.CACHE_FILE);
      cache = JSON.parse(data.toString());
      if (!cache.languages) {
        cache.languages = {};
      }
    } catch (error) {
      cache = { edges: {}, languages: {} };
    }
  }

  await handleEdgesUpdate(userId, cache, edges);
  return cache;
}
