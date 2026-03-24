
const fs = require('fs');
const path = require('path');

// 結合するファイルのリスト（パスは環境に合わせて調整してください）
const filesToBundle = [
    { name: 'package.json', path: './package.json' },
    { name: 'Dockerfile', path: './Dockerfile' },
    { name: 'start.sh', path: './start.sh' },
    { name: '.dockerignore', path: './.dockerignore' },
    { name: 'app/index.js', path: './app/index.js' } // index.jsがappフォルダ内にある場合
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