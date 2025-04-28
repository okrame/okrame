import { buildCache } from "./src/cache"
import { getEdges, getEdgesFromOrgs, getUserInfo } from "./src/queries"
import { CacheInstance, Edge, UserInfo } from "./src/types"
import { COUNTERS, generateSVG, getStats } from "./src/utils"
import { writeFileSync } from "fs"

async function main() {

    var userInfo: UserInfo;
    try {
        userInfo = await getUserInfo(process.env.GITHUB_USERNAME)
    } catch (error) {
        let message = 'Unknown Error'
        if (error instanceof Error) message = error.message
        console.log(`An error occurred while fetching user info: ${message}`)
        return
    }

    const personalRepos: Edge[] = await getEdges(['OWNER', 'COLLABORATOR', 'ORGANIZATION_MEMBER'], undefined, [])
    const orgsRepos: Edge[] = await getEdgesFromOrgs(undefined, [])
    const allRepos = personalRepos.concat(orgsRepos)
    const cache: CacheInstance = await buildCache(userInfo.id, allRepos)

    writeFileSync(process.env.CACHE_FILE, JSON.stringify(cache, null, "\t"))
    console.log(`Queries: userInfo=${COUNTERS.userInfo} edges=${COUNTERS.edges} org-edges=${COUNTERS.orgEdges} repoInfo=${COUNTERS.repoInfo}`)

    const svg = generateSVG(getStats(cache, userInfo))
    writeFileSync('generated/cover.svg', svg);
    console.log(`Image generated successfully`)

}

(async () => {
    await main();
    process.exit();
})();