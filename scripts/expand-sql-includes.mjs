import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readFileSafely(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

async function expandSql(filePath, visited = new Set()) {
  const absolutePath = path.resolve(filePath);

  if (visited.has(absolutePath)) {
    return `-- Skipping already included file: ${absolutePath}\n`;
  }
  visited.add(absolutePath);

  const fileDir = path.dirname(absolutePath);
  const content = await readFileSafely(absolutePath);
  const lines = content.split(/\r?\n/);
  const out = [];

  out.push(`-- BEGIN FILE: ${absolutePath}`);

  for (const line of lines) {
    const match = /^\s*\\i\s+(.+)\s*$/.exec(line);
    if (match) {
      const includePathRaw = match[1].trim();
      const includePath = includePathRaw.replace(/^['"]|['"]$/g, '');
      const resolved = path.resolve(fileDir, includePath);
      const expanded = await expandSql(resolved, visited);
      out.push(`-- BEGIN INCLUDE: ${includePath} -> ${resolved}`);
      out.push(expanded);
      out.push(`-- END INCLUDE: ${includePath}`);
    } else {
      out.push(line);
    }
  }

  out.push(`-- END FILE: ${absolutePath}`);
  return out.join('\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { input: 'setup_database.sql', output: 'dist/setup_database_expanded.sql' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-i' || arg === '--input') && args[i + 1]) {
      result.input = args[++i];
    } else if ((arg === '-o' || arg === '--output') && args[i + 1]) {
      result.output = args[++i];
    }
  }
  return result;
}

async function main() {
  const { input, output } = parseArgs();
  const projectRoot = path.resolve(__dirname, '..');
  const inputPath = path.resolve(projectRoot, input);
  const outputPath = path.resolve(projectRoot, output);

  const expanded = await expandSql(inputPath);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, expanded, 'utf-8');
  console.log(`✅ Wrote expanded SQL to: ${outputPath}`);
}

main().catch((err) => {
  console.error('❌ Failed to expand SQL includes:', err);
  process.exit(1);
});