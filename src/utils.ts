import { createCanvas } from "canvas";
import { CacheInstance, EdgeInfo, LanguageStats, Stats, UserInfo } from "./types";

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

    return { 
        accountAge, 
        repoCount, 
        commits, 
        additions, 
        deletions,
        languages: cache.languages || {}
    }
}

function generateLanguagePieChart(languages: LanguageStats, size = 300): string {
    const totalSize = Object.values(languages).reduce((sum, size) => sum + size, 0);
    
    const sortedLangs = Object.entries(languages)
        .map(([name, size]) => ({
            name,
            size,
            percentage: (size / totalSize) * 100
        }))
        .sort((a, b) => b.size - a.size);
    
    const mainLangs = sortedLangs.filter(lang => lang.percentage >= 1.0);
    const smallLangs = sortedLangs.filter(lang => lang.percentage < 1.0);
    
    let pieData: Array<{ name: string; size: number; percentage: number; color?: string }> = [...mainLangs];
    
    if (smallLangs.length > 0) {
        const othersSize = smallLangs.reduce((sum, lang) => sum + lang.size, 0);
        const othersPercentage = (othersSize / totalSize) * 100;
        
        pieData.push({
            name: "Others",
            size: othersSize,
            percentage: othersPercentage
        });
    }
    
    const colorMap: {[key: string]: string} = {
        "Python": "#3776AB",
        "TypeScript": "#3178C6",
        "JavaScript": "#F7DF1E",
        "CSS": "#1572B6",
        "Rust": "#B7410E",
        "Solidity": "#363636",
        "Circom": "#58A6FF",
        "Haskell": "#5D4F85",
        "MATLAB": "#0076A8",
        "C++": "#00599C",
        "R": "#276DC3",
        "C": "#A8B9CC",
        "Java": "#007396",
        "Ruby": "#CC342D",
        "Shell": "#4EAA25",
        "PowerShell": "#5391FE",
        "PLSQL": "#F80000",
        "Makefile": "#427819",
        "Others": "#808080"
    };
    
    const fallbackColors = [
        "#FF6B6B", "#4ECDC4", "#FFE66D", "#1A535C", "#F7FFF7", 
        "#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4"
    ];
    
    pieData = pieData.map((lang, i) => ({
        ...lang,
        color: colorMap[lang.name] || fallbackColors[i % fallbackColors.length]
    }));
    
    const radius = size / 2;
    const centerX = radius;
    const centerY = radius;
    let startAngle = 0;
    
    const wedges = pieData.map((item, index) => {
        const angle = (item.percentage / 100) * 360;
        const endAngle = startAngle + angle;
        
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);
        
        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const labelRad = (startAngle + angle / 2 - 90) * (Math.PI / 180);
        const labelDistance = radius * 0.7;
        const labelX = centerX + labelDistance * Math.cos(labelRad);
        const labelY = centerY + labelDistance * Math.sin(labelRad);
        
        const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        const color = item.color || "#000000"; 
        const r = parseInt(color.substring(1, 3), 16);
        const g = parseInt(color.substring(3, 5), 16);
        const b = parseInt(color.substring(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 128 ? "#000000" : "#FFFFFF";
        
        const result = {
            path,
            color: item.color,
            percentage: item.percentage,
            labelX,
            labelY,
            name: item.name,
            textColor
        };
        
        startAngle = endAngle;
        return result;
    });
    
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Pie Chart Wedges -->
`;
    
    wedges.forEach(wedge => {
        svg += `  <path d="${wedge.path}" fill="${wedge.color}" stroke="#333" stroke-width="0.5" />
`;
    });
    
    wedges.forEach(wedge => {
        if (wedge.percentage >= 3) {
            svg += `  <text x="${wedge.labelX}" y="${wedge.labelY}" text-anchor="middle" dominant-baseline="middle" fill="${wedge.textColor}" font-weight="bold" font-family="monospace">${Math.round(wedge.percentage)}%</text>
`;
        }
    });
    
    svg += `</svg>`;
    
    return svg;
}

export function generateSVG(stats: Stats): string {
    const username = process.env.GITHUB_USERNAME;

    const width = 1000;      
    const padding = 50;      
    const lineSpace = 35;    
    const fontSize = 30;    
    const fontFamily = 'monospace';
    const pieChartSize = 300; 

    const canvas = createCanvas(200, 100);
    const context = canvas.getContext('2d');
    context.font = `${fontSize}px ${fontFamily}`;
    const metrics = context.measureText('w');
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    const commandY = padding + textHeight;
    const statsY = commandY + 1.5 * lineSpace;
    const pieChartY = statsY + 4 * lineSpace + 20; 
    
    const height = pieChartY + pieChartSize + padding;
    
    const pieChart = generateLanguagePieChart(stats.languages, pieChartSize);
 
    
    let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
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
            fill: #FF5555;
        }
        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
    </style>
    <rect width="100%" height="100%" fill="black" rx="15"/>

    <!-- Stats Section -->
    <text x="${padding}" y="${padding}" class="console ascii-art">
        <tspan x="${padding}" y="${commandY}">$ ${username} github-stats</tspan>
        <tspan x="${padding}" y="${statsY}"><tspan class="cyan">account-age:</tspan> <tspan class="white">${stats.accountAge} days</tspan></tspan>
        <tspan x="${padding}" y="${statsY + lineSpace}"><tspan class="cyan">repos:</tspan> <tspan class="white">${stats.repoCount}</tspan></tspan>
        <tspan x="${padding}" y="${statsY + 2*lineSpace}"><tspan class="cyan">commits:</tspan> <tspan class="white">${stats.commits}</tspan></tspan>
        <tspan x="${padding}" y="${statsY + 3*lineSpace}"><tspan class="cyan">lines:</tspan> <tspan class="white">${stats.additions - stats.deletions} (<tspan class="green">${stats.additions}++</tspan>, <tspan class="red">${stats.deletions}--</tspan>)</tspan></tspan>
        <tspan x="${padding}" y="${statsY + 4*lineSpace}"><tspan class="cyan">languages:</tspan></tspan>

    </text>

    <!-- Pie Chart -->
    <g transform="translate(${padding}, ${pieChartY})">
        ${pieChart}
    </g>

    <!-- Legend -->
    <g transform="translate(${padding + pieChartSize + 50}, ${pieChartY + 20})">`;

    const totalSize = Object.values(stats.languages).reduce((sum, size) => sum + size, 0);
    
    const sortedLangs = sortAllLanguages(stats.languages);
    const mainLangs = sortedLangs.filter(lang => lang.percentage >= 1.0);
    const smallLangs = sortedLangs.filter(lang => lang.percentage < 1.0);
    
    mainLangs.forEach((lang, index) => {
        const colorMap: {[key: string]: string} = {
            "Python": "#3776AB",
            "TypeScript": "#3178C6",
            "JavaScript": "#F7DF1E",
            "HTML": "#E34F26",
            "CSS": "#1572B6",
            "Rust": "#B7410E",
            "Solidity": "#363636",
            "Circom": "#58A6FF",
            "Haskell": "#5D4F85",
            "MATLAB": "#0076A8",
            "C++": "#00599C",
            "Others": "#808080",
           
        };
        
        const fallbackColors = [
            "#FF6B6B", "#4ECDC4", "#FFE66D", "#1A535C", "#F7FFF7", 
            "#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4"
        ];
        
        const color = colorMap[lang.name] || fallbackColors[index % fallbackColors.length];
        
        svg += `
        <rect x="0" y="${index * 35}" width="20" height="20" fill="${color}" stroke="#333" stroke-width="1" />
        <text x="30" y="${index * 35 + 16}" class="white">${lang.name.padEnd(15)} ${lang.percentage.toFixed(1)}%</text>`;
    });
    
    if (smallLangs.length > 0) {
        const othersSize = smallLangs.reduce((sum, lang) => sum + lang.size, 0);
        const othersPercentage = (othersSize / totalSize) * 100;
        const index = mainLangs.length;
        
        svg += `
        <rect x="0" y="${index * 35}" width="20" height="20" fill="#808080" stroke="#333" stroke-width="1" />
        <text x="30" y="${index * 35 + 16}" class="white">Others${' '.repeat(9)} ${othersPercentage.toFixed(1)}%</text>`;
    }

    svg += `
    </g>
</svg>`;

    return svg;
}

function sortAllLanguages(languages: LanguageStats): Array<{name: string, size: number, percentage: number}> {
    const totalSize = Object.values(languages).reduce((sum, size) => sum + size, 0);
    
    const sortedLangs = Object.entries(languages)
        .map(([name, size]) => ({
            name,
            size,
            percentage: (size / totalSize) * 100
        }))
        .sort((a, b) => b.size - a.size);
    
    return sortedLangs;
}