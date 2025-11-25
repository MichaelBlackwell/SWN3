const fs = require('fs');
const path = require('path');

function generateManifest(rootDir, outputFile) {
  const root = path.join('public', 'assets', rootDir);
  const sortFiles = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const manifest = {};

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const dirPath = path.join(root, entry.name);
      const files = fs
        .readdirSync(dirPath)
        .filter((file) => file.toLowerCase().endsWith('.png'))
        .sort(sortFiles);

      manifest[entry.name] = files.map((file) => `/assets/${rootDir}/${entry.name}/${file}`);
    }
  }

  const header = `/**\n * Auto-generated manifest for ${rootDir}.\n * Generated on ${new Date().toISOString()}\n */\n`;
  const content = `${header}export const ${rootDir}Manifest = ${JSON.stringify(manifest, null, 2)} as const;\n\nexport type ${capitalize(rootDir)}Category = keyof typeof ${rootDir}Manifest;\n\nexport const ${rootDir}Categories = Object.keys(${rootDir}Manifest) as ${capitalize(rootDir)}Category[];\n\nexport function get${capitalize(rootDir)}Paths(category: ${capitalize(rootDir)}Category) {\n  return ${rootDir}Manifest[category];\n}\n`;

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, content);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const landscapesOutput = path.join('src', 'data', 'landscapesManifest.ts');
generateManifest('landscapes', landscapesOutput);
