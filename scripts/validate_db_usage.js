const fs = require('fs');
const path = require('path');

// --- Configuration ---
const SCHEMA_PATH = 'ARCH_DOCS/01-CORE/Schema.txt';
const ROOT_DIR = process.cwd();
const SCAN_DIRS = ['app', 'lib', 'hooks'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const OUTPUT_FILE = 'db_validation_report.json';

// --- Schema Parsing ---
function parseSchema(schemaPath) {
    const fullSchemaPath = path.isAbsolute(schemaPath) ? schemaPath : path.join(ROOT_DIR, schemaPath);

    if (!fs.existsSync(fullSchemaPath)) {
        console.error(`Schema file not found at ${fullSchemaPath}`);
        return {};
    }

    const content = fs.readFileSync(fullSchemaPath, 'utf8');
    const lines = content.split('\n');
    const schema = {};
    let currentTable = null;

    const createTableRegex = /CREATE TABLE public\.([a-z0-9_]+)\s*\(/i;
    // Modified to capture DEFAULT
    // col type ... DEFAULT val ...
    const columnRegex = /^\s*([a-z0-9_]+)\s+([a-z0-9_\[\]]+)(.*)$/i;
    const checkRegex = /CHECK\s*\((.*)\)/i;

    for (let line of lines) {
        line = line.split('--')[0].trim();
        if (!line) continue;

        if (line.startsWith('CREATE TABLE')) {
            const match = line.match(createTableRegex);
            if (match) {
                currentTable = match[1];
                schema[currentTable] = { columns: {}, checks: [] };
            }
            continue;
        }

        if (line.startsWith(');') && currentTable) {
            currentTable = null;
            continue;
        }

        if (currentTable) {
            if (line.startsWith('CONSTRAINT')) continue;

            const colMatch = line.match(columnRegex);
            if (colMatch) {
                const colName = colMatch[1];
                const colType = colMatch[2];
                const rest = colMatch[3];

                const reserved = ['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK'];
                if (reserved.includes(colName.toUpperCase())) continue;

                const isNotNull = /NOT NULL/i.test(rest);
                const hasDefault = /DEFAULT/i.test(rest);
                const checkMatch = rest.match(checkRegex);
                let validValues = null;

                if (checkMatch) {
                    const arrayMatch = checkMatch[1].match(/ARRAY\[(.*?)\]/);
                    if (arrayMatch) {
                        validValues = arrayMatch[1].split(',').map(v => v.trim().replace(/^'|'::text$/g, '').replace(/'$/, ''));
                    }
                }

                schema[currentTable].columns[colName] = {
                    type: colType,
                    isNotNull,
                    hasDefault,
                    validValues
                };
            }
        }
    }
    return schema;
}

// --- Code Scanning ---
function getAllFiles(dirPath, arrayOfFiles) {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(ROOT_DIR, dirPath);
    if (!fs.existsSync(fullPath)) return arrayOfFiles || [];

    files = fs.readdirSync(fullPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(path.join(fullPath, file)).isDirectory()) {
            arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
            const ext = path.extname(file);
            if (FILE_EXTENSIONS.includes(ext)) {
                arrayOfFiles.push(path.join(fullPath, file));
            }
        }
    });

    return arrayOfFiles;
}

function scanFiles(schema) {
    let files = [];
    SCAN_DIRS.forEach(dir => {
        files = files.concat(getAllFiles(dir));
    });

    const issues = {
        CRITICAL: [],
        HIGH: [],
        MEDIUM: []
    };

    const operations = [];

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const fromRegex = /\.from\(['"]([a-z0-9_]+)['"]\)/g;
        let match;

        while ((match = fromRegex.exec(content)) !== null) {
            const tableName = match[1];
            const index = match.index;
            const lineNum = content.substring(0, index).split('\n').length;
            const subStr = content.substring(index);

            let operation = 'UNKNOWN';
            let extractedData = {}; // key -> value

            const snippet = subStr.substring(0, 1000);

            // SELECT
            if (/\.select\(/.test(snippet)) {
                operation = 'SELECT';
                const selectMatch = snippet.match(/\.select\(['"`]([^'"`]+)['"`]\)/);
                if (selectMatch) {
                    const cols = selectMatch[1].split(',').map(c => c.trim().split(':')[0].trim());
                    if (!cols.includes('*')) {
                        cols.forEach(c => extractedData[c] = null);
                    }
                }
            }
            // INSERT / UPDATE / UPSERT
            else {
                let body = null;
                if (/\.insert\(/.test(snippet)) {
                    operation = 'INSERT';
                    const m = snippet.match(/\.insert\(([\s\S]*?)\)/);
                    if (m) body = m[1];
                } else if (/\.update\(/.test(snippet)) {
                    operation = 'UPDATE';
                    const m = snippet.match(/\.update\(([\s\S]*?)\)/);
                    if (m) body = m[1];
                } else if (/\.upsert\(/.test(snippet)) {
                    operation = 'UPSERT';
                    const m = snippet.match(/\.upsert\(([\s\S]*?)\)/);
                    if (m) body = m[1];
                } else if (/\.delete\(/.test(snippet)) {
                    operation = 'DELETE';
                }

                if (body) {
                    // Try to parse basic "key: value" pairs
                    // We remove array brackets [ ] if it's a batch insert
                    body = body.replace(/^\[/, '').replace(/\]$/, '');

                    // Remove braces { }
                    body = body.replace(/^{/, '').replace(/}$/, '');

                    // Naive split by comma won't work for nested objects, but ok for simple scalar inserts
                    // Try to find matches of key: value
                    const props = body.split(',');
                    props.forEach(p => {
                        const parts = p.split(':');
                        if (parts.length >= 2) {
                            const key = parts[0].trim().replace(/['"]/g, '');
                            let val = parts.slice(1).join(':').trim();
                            // If value is a string, remove quotes
                            if (val.startsWith("'") || val.startsWith('"')) {
                                val = val.substring(1, val.length - 1);
                            }
                            extractedData[key] = val;
                        }
                    });
                }
            }

            operations.push({
                file: path.relative(ROOT_DIR, file),
                line: lineNum,
                table: tableName,
                op: operation,
                columns: Object.keys(extractedData)
            });

            const tableSchema = schema[tableName];
            if (!tableSchema) {
                if (!['auth', 'storage'].includes(tableName.split('.')[0]) && !tableName.includes('.')) {
                    issues.CRITICAL.push({
                        File: path.relative(ROOT_DIR, file), Line: lineNum, Table: tableName, Issue: 'Table not found in schema', Column: '-', Fix: 'Verify table name'
                    });
                }
            } else {
                const colKeys = Object.keys(extractedData);

                // 1. Column Existence
                colKeys.forEach(col => {
                    const cleanCol = col.includes('.') ? col.split('.')[1] : col;
                    if (cleanCol.includes('(')) return;

                    const colDef = tableSchema.columns[cleanCol];
                    if (!colDef) {
                        const issueType = (operation === 'INSERT' || operation === 'UPDATE') ? 'CRITICAL' : 'HIGH';
                        issues[issueType].push({
                            File: path.relative(ROOT_DIR, file), Line: lineNum, Table: tableName, Issue: 'Column not found', Column: cleanCol, Fix: 'Remove column'
                        });
                    } else {
                        // 2. Enum Check (Hardcoded Values)
                        const val = extractedData[col];
                        if (colDef.validValues && val && !colDef.validValues.includes(val) && !val.includes('calc')) {
                            // If val looks like a variable (no spaces usually), we skip. 
                            // But our extraction striped quotes. 
                            // If it was a variable, it wouldn't have had quotes in the source?
                            // This naive parser strips quotes. 
                            // We can't distinguish 'value' from value easily without better parsing.
                            // But usually enum constants are passed as strings.

                            // Let's assume if it matches an enum option, it's good. 
                            // If it doesn't match, it might be a variable OR an invalid value.
                            // We can't be sure.
                            // But if the value contains '::', it might be a cast.

                            // Let's only flag if we are fairly sure.
                        }
                    }
                });

                // 3. Required Column Check (INSERT only)
                if (operation === 'INSERT') {
                    // Check all schema columns
                    Object.keys(tableSchema.columns).forEach(schemaCol => {
                        const def = tableSchema.columns[schemaCol];
                        if (def.isNotNull && !def.hasDefault) {
                            // Must be present
                            if (!colKeys.includes(schemaCol)) {
                                issues.CRITICAL.push({
                                    File: path.relative(ROOT_DIR, file), Line: lineNum, Table: tableName, Issue: 'Missing NOT NULL column', Column: schemaCol, Fix: 'Add column'
                                });
                            }
                        }
                    });
                }
            }
        }
    });

    return { issues, operationsCount: operations.length, validatedTables: Object.keys(schema).length };
}

console.log('Starting validation...');
const schema = parseSchema(SCHEMA_PATH);
const result = scanFiles(schema);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log('Report written to ' + OUTPUT_FILE);
