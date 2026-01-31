
const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
    try {
        if (!fs.existsSync(dirPath)) return arrayOfFiles || [];
        const files = fs.readdirSync(dirPath);

        arrayOfFiles = arrayOfFiles || [];

        files.forEach(function (file) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            } else {
                if (file === 'route.ts' || file === 'route.tsx') {
                    arrayOfFiles.push(fullPath);
                }
            }
        });
    } catch (e) {
        console.error("Error reading dir " + dirPath, e);
    }

    return arrayOfFiles;
}

const apiDir = path.join(process.cwd(), 'app', 'api');
console.log("Scanning " + apiDir);
const files = getAllFiles(apiDir);

console.log(`Found ${files.length} route files.`);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    if (content.includes("export const runtime = 'edge'") || content.includes('export const runtime = "edge"')) {
        console.log(`Skipping ${path.basename(path.dirname(file))}/${path.basename(file)}`);
        return;
    }

    // Add logic
    let modified = false;
    if (content.includes("export const dynamic")) {
        content = content.replace(/(export const dynamic = .+\n)/, "$1export const runtime = 'edge'\n");
        modified = true;
    } else {
        // Find imports end
        const lines = content.split('\n');
        let lastImport = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import') || lines[i].trim().startsWith('//') || lines[i].trim().startsWith('/*')) {
                if (lines[i].trim().startsWith('import')) lastImport = i;
            }
        }
        // Insert after last import or at top
        const insertPos = lastImport + 1;
        lines.splice(insertPos, 0, "", "export const runtime = 'edge'");
        content = lines.join('\n');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(file, content);
        console.log(`Fixed ${path.basename(path.dirname(file))}/${path.basename(file)}`);
    }
});
