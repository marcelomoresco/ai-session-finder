// Rasterizes the SVG masters into the app icon (.png + .icns) and the template
// tray icons. Run: `node apps/main/scripts/gen-icons.mjs` (Node 20).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import png2icons from 'png2icons';

const here = dirname(fileURLToPath(import.meta.url));
const mainRoot = join(here, '..');
const resources = join(mainRoot, 'resources');
mkdirSync(resources, { recursive: true });

const logoSvg = readFileSync(join(mainRoot, '../renderer/src/assets/logo.svg'));
const traySvg = readFileSync(join(resources, 'tray-iconTemplate.svg'));

await sharp(logoSvg).resize(1024, 1024).png().toFile(join(resources, 'icon.png'));
await sharp(traySvg).resize(18, 18).png().toFile(join(resources, 'tray-iconTemplate.png'));
await sharp(traySvg).resize(36, 36).png().toFile(join(resources, 'tray-iconTemplate@2x.png'));

const iconPng = readFileSync(join(resources, 'icon.png'));
writeFileSync(join(resources, 'icon.icns'), png2icons.createICNS(iconPng, png2icons.BILINEAR, 0));

console.log('Generated: icon.png, icon.icns, tray-iconTemplate.png (+@2x)');
