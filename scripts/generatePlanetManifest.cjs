const fs = require('fs');
const path = require('path');

const root = path.join('public', 'assets', 'planets');
const sortFiles = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const manifest = {};

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const dirPath = path.join(root, entry.name);
    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.toLowerCase().endsWith('.png'))
      .sort(sortFiles);

    manifest[entry.name] = files.map((file) => `/assets/planets/${entry.name}/${file}`);
  }
}

const licensePath = fs.existsSync(path.join(root, 'License.txt')) ? '/assets/planets/License.txt' : null;
const licenseLiteral = licensePath ? `'${licensePath}'` : 'null';
const target = path.join('src', 'data', 'planetsManifest.ts');

const header = `/**\n * Auto-generated manifest of available planet sprites.\n * Generated on ${new Date().toISOString()}\n */\n`;
const manifestExport = `export const planetSpriteManifest = ${JSON.stringify(manifest, null, 2)} as const;\n`;

const content = `${header}${manifestExport}\nexport type PlanetSpriteCategory = keyof typeof planetSpriteManifest;\n\nexport const planetSpriteCategories = Object.keys(planetSpriteManifest) as PlanetSpriteCategory[];\n\nexport const planetSpriteLicensePath = ${licenseLiteral} as const;\n\nexport function getPlanetSpritePaths(category: PlanetSpriteCategory) {\n  return planetSpriteManifest[category];\n}\n`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, content);
