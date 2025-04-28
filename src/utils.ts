import { createCanvas } from "canvas";
import { CacheInstance, EdgeInfo, Stats, UserInfo } from "./types";

export function isEdgeInfoEntry(obj: any): obj is EdgeInfo {
    return 'additions' in obj && 'deletions' in obj && 'commits' in obj && 'totalCommits' in obj
}

export const COUNTERS = { userInfo: 0, edges: 0, orgEdges: 0, repoInfo: 0 }

export function increaseCounter(key: string) {
    COUNTERS[key] += 1;
}

export function getStats(cache: CacheInstance, userInfo: UserInfo): Stats {
    const accountAge = Math.floor(
        (new Date().getTime() - new Date(userInfo.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const repoCount = Object.keys(cache.edges).length

    var commits = 0
    var additions = 0
    var deletions = 0

    if (cache.hasOwnProperty('edges')) {
        for (const [key, value] of Object.entries(cache.edges)) {
            commits += cache.edges[key].commits ? cache.edges[key].commits : 0
            additions += cache.edges[key].additions ? cache.edges[key].additions : 0
            deletions += cache.edges[key].deletions ? cache.edges[key].deletions : 0
        }
    }

    return { accountAge, repoCount, commits, additions, deletions }
}

export function generateSVG(stats: Stats): string {
    const username = process.env.GITHUB_USERNAME

    const width = 985
    const padding = 50
    const lineSpace = 35
    const fontSize = 30
    const fontFamily = 'monospace'

    // Get char height in pixels
    const canvas = createCanvas(200, 100)
    const context = canvas.getContext('2d')
    context.font = `${fontSize}px ${fontFamily}`
    const metrics = context.measureText('w')
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

    // Calculate elements y
    const commandY = padding + textHeight
    const statsY = commandY + 1.5 * lineSpace
    const height = statsY + (3 * lineSpace) + padding

    // Generate Console-Style SVG
    const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>
          text, tspan {
            white-space: pre;
            font-family: monospace;
        }
        .console { 
            font-size: ${fontSize}px; 
            fill: #00FF00; 
            line-height: 1.2;
        }
        .cyan {
            fill: #00FFFF;
        }
        .white {
            fill: #FFFFFF;
        }
        .green {
            fill: #4CCC6C;
        }
        .red {
            fill: #FF5555
        }
      </style>
      <rect width="100%" height="100%" fill="black" rx="15"/>
  
      <text x="${padding}" y="${padding}" class="console ascii-art">
          <tspan x="${padding}" y="${commandY}">$ ${username} github-stats</tspan>
          <tspan x="${padding}" y="${statsY}"><tspan class="cyan">account-age:</tspan> <tspan class="white">${stats.accountAge} days</tspan></tspan>
          <tspan x="${padding}" y="${statsY + lineSpace}"><tspan class="cyan">repos:</tspan> <tspan class="white">${stats.repoCount}</tspan></tspan>
          <tspan x="${padding}" y="${statsY + 2*lineSpace}"><tspan class="cyan">commits:</tspan> <tspan class="white">${stats.commits}</tspan></tspan>
          <tspan x="${padding}" y="${statsY + 3*lineSpace}"><tspan class="cyan">lines:</tspan> <tspan class="white">${stats.additions - stats.deletions} (<tspan class="green">${stats.additions}++</tspan>, <tspan class="red">${stats.deletions}--</tspan>)</tspan></tspan>
      </text>

  </svg>
  `

    return svg
}