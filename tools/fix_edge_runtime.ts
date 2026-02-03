
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function main() {
    const apiDir = path.join(process.cwd(), 'app', 'api');

    // Find all route.ts files in app/api
    const files = await glob('app/api/**/route.ts', { cwd: process.cwd(), absolute: true });

    console.log(`Found ${files.length} route files.`);

    for (const file of files) {
        let content = fs.readFileSync(file, 'utf-8');

        // Check if runtime is already exported
        if (content.includes('export const runtime')) {
            console.log(`Skipping ${path.basename(path.dirname(file))}/${path.basename(file)} (runtime already defined)`);
            continue;
        }

        // Check if it's dynamic
        const hasDynamic = content.includes('export const dynamic');

        // Add runtime = 'edge'
        // If hasDynamic, add after it. If not, add after imports.

        if (hasDynamic) {
            // Find the line with export const dynamic
            const lines = content.split('\n');
            const dynamicLineIndex = lines.findIndex(line => line.includes('export const dynamic'));

            if (dynamicLineIndex !== -1) {
                lines.splice(dynamicLineIndex + 1, 0, "export const runtime = 'edge'");
                content = lines.join('\n');
            }
        } else {
            // Try to insert after last import
            const lines = content.split('\n');
            let lastImportIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('importtype ')) {
                    lastImportIndex = i;
                }
            }

            if (lastImportIndex !== -1) {
                lines.splice(lastImportIndex + 1, 0, "", "export const runtime = 'edge'");
            } else {
                // No imports? pretty rare, just prepend
                lines.unshift("export const runtime = 'edge'");
            }
            content = lines.join('\n');
        }

        fs.writeFileSync(file, content, 'utf-8');
        console.log(`Updated ${path.basename(path.dirname(file))}/${path.basename(file)}`);
    }
}

main().catch(console.error);
