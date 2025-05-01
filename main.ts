import { buildCache } from "./src/cache"
import { getEdges, getEdgesFromOrgs, getUserInfo } from "./src/queries"
import { CacheInstance, Edge, UserInfo } from "./src/types"
import { COUNTERS, generateSVG, getStats } from "./src/utils"
import { writeFileSync } from "fs"

async function main() {

    var userInfo: UserInfo;
    try {
        userInfo = await getUserInfo(process.env.GITHUB_USERNAME)
        console.log(`User info fetched successfully for ${process.env.GITHUB_USERNAME}`)
    } catch (error) {
        let message = 'Unknown Error'
        if (error instanceof Error) message = error.message
        console.log(`An error occurred while fetching user info: ${message}`)
        return
    }

    console.log("Fetching personal repositories...")
    const personalRepos: Edge[] = await getEdges(['OWNER', 'COLLABORATOR', 'ORGANIZATION_MEMBER'], undefined, [])
    console.log(`Found ${personalRepos.length} personal repositories`)
    
    // Debug the first repo to see if languages data is present
    if (personalRepos.length > 0) {
        console.log("Sample repository data:")
        console.log(`Name: ${personalRepos[0].node.nameWithOwner}`)
        console.log(`Has language data: ${personalRepos[0].node.languages ? 'Yes' : 'No'}`)
        if (personalRepos[0].node.languages && personalRepos[0].node.languages.edges) {
            console.log(`Languages: ${personalRepos[0].node.languages.edges.map(e => e.node.name).join(', ')}`)
        }
    }
    
    console.log("Fetching organization repositories...")
    const orgsRepos: Edge[] = await getEdgesFromOrgs(undefined, [])
    console.log(`Found ${orgsRepos.length} organization repositories`)
    
    const allRepos = personalRepos.concat(orgsRepos)
    console.log(`Total repositories: ${allRepos.length}`)
    
    console.log("Building cache...")
    const cache: CacheInstance = await buildCache(userInfo.id, allRepos)

    writeFileSync(process.env.CACHE_FILE, JSON.stringify(cache, null, "\t"))
    console.log(`Queries: userInfo=${COUNTERS.userInfo} edges=${COUNTERS.edges} org-edges=${COUNTERS.orgEdges} repoInfo=${COUNTERS.repoInfo}`)

    const stats = getStats(cache, userInfo)
    console.log(`Stats generated: Languages found: ${Object.keys(stats.languages).length}`)
    
    // Debug languages data
    if (Object.keys(stats.languages).length > 0) {
        console.log("Languages detected:")
        const languages = Object.entries(stats.languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        for (const [lang, size] of languages) {
            console.log(`- ${lang}: ${size} bytes`)
        }
    } else {
        console.log("No languages data found. Check token permissions and repository content.")
    }
    
    const svg = generateSVG(stats)
    writeFileSync('generated/cover.svg', svg);
    console.log(`Image generated successfully`)

}

(async () => {
    await main();
    process.exit();
})();