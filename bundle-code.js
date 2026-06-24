
const fs = require('fs');
const path = require('path');

// src/ 配下の .js を再帰的に収集
function collectJsFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectJsFiles(full));
        } else if (entry.name.endsWith('.js')) {
            const rel = path.relative(__dirname, full);
            results.push({ name: rel, path: './' + rel });
        }
    }
    return results;
}

// 結合するファイルのリスト
const filesToBundle = [
    { name: 'package.json', path: './package.json' },
    { name: 'Dockerfile', path: './Dockerfile' },
    { name: 'start.sh', path: './start.sh' },
    { name: 'index.js', path: './index.js' },
    ...collectJsFiles(path.resolve(__dirname, 'src')),
];

const outputFileName = 'project-bundle-for-ai.txt';

let bundledContent = `================================================
REAL ONIGOKKO BOT PROJECT BUNDLE
Generated on: ${new Date().toLocaleString()}
================================================\n\n`;

filesToBundle.forEach(file => {
    const filePath = path.resolve(__dirname, file.path);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        bundledContent += `\n################################################\n`;
        bundledContent += `FILE: ${file.name}\n`;
        bundledContent += `################################################\n\n`;
        bundledContent += content;
        bundledContent += `\n\n`;
        console.log(`✅ Added: ${file.name}`);
    } else {
        console.log(`❌ Not Found: ${file.name} (Skipped)`);
    }
});

fs.writeFileSync(outputFileName, bundledContent);
console.log(`\n✨ Successfully created ${outputFileName}`);
console.log(`このファイルを新しいAIに読み込ませてください。`);