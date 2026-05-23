import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const PAGES = path.join(ROOT, 'pages');
const DIST = path.join(ROOT, 'dist');

const customTagRegex = /<([a-z0-9]+-[a-z0-9-]+)([\s\S]*?)\s*(?:\/>|>\s*<\/\1\s*>)/gi;

function resolveCustomTags(html) {
  return html.replace(customTagRegex, (match, tagName, attributesString) => {
    const templatePath = path.join(SRC, 'templates', `${tagName.toLowerCase()}.html`);

    if (!fs.existsSync(templatePath)) {
      console.warn(`Warning: Found tag <${tagName}> but no template at ${templatePath}`);
      return match;
    }

    let populated = fs.readFileSync(templatePath, 'utf8');
    const attrRegex = /([a-z0-9-]+)=["']([^"']*)["']/gi;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2];
      populated = populated.split(`{{${attrName}}}`).join(attrValue);
    }

    return populated;
  });
}

function compilePage(html) {
  let output = html;
  let previous;

  do {
    previous = output;
    output = resolveCustomTags(output);
  } while (output !== previous);

  return output;
}

function copyAssets() {
  const assetsDir = path.join(SRC, 'assets');
  const distAssetsDir = path.join(DIST, 'assets');

  if (!fs.existsSync(assetsDir)) {
    return;
  }

  fs.mkdirSync(distAssetsDir, { recursive: true });

  for (const file of fs.readdirSync(assetsDir)) {
    fs.copyFileSync(path.join(assetsDir, file), path.join(distAssetsDir, file));
  }
}

function build() {
  const pageFiles = fs
    .readdirSync(PAGES)
    .filter((file) => file.endsWith('.src.html'));

  if (pageFiles.length === 0) {
    console.error('No pages/*.src.html files found.');
    process.exit(1);
  }

  fs.mkdirSync(DIST, { recursive: true });

  for (const file of fs.readdirSync(DIST)) {
    if (file.endsWith('.html')) {
      fs.unlinkSync(path.join(DIST, file));
    }
  }

  for (const file of pageFiles) {
    const srcPath = path.join(PAGES, file);
    const outName = file.replace('.src.html', '.html');
    const html = compilePage(fs.readFileSync(srcPath, 'utf8'));

    fs.writeFileSync(path.join(DIST, outName), html);
    console.log(`Built dist/${outName}`);
  }

  copyAssets();
}

build();
