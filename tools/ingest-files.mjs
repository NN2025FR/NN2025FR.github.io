#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FILES_DIR = path.join(PROJECT_ROOT, 'files');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'index.json');

const DEFAULT_PATH_DEPTH = Number.parseInt(process.env.PATH_DEPTH ?? '3', 10);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const depthArgIndex = args.findIndex((arg) => arg === '--depth');
const pathDepth = depthArgIndex !== -1 ? Number.parseInt(args[depthArgIndex + 1], 10) : DEFAULT_PATH_DEPTH;

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function titleize(segment) {
  return segment
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(\p{L})(\p{L}*)/gu, (_, first, rest) => `${first.toUpperCase()}${rest.toLowerCase()}`)
    .replace(/\b(\d+)([a-z]+)/gi, (_, num, word) => `${num}${word.toLowerCase()}`)
    .replace(/\b([IVXLCDM]+)\b/g, (match) => match.toUpperCase());
}

function ensureChildren(node) {
  if (!node.children) {
    node.children = [];
  }
  return node.children;
}

function findDirChild(parent, segment) {
  const slug = slugify(segment);
  return ensureChildren(parent).find((child) => child.type === 'dir' && slugify(child.name) === slug);
}

function ensureDir(parent, segment) {
  const existing = findDirChild(parent, segment);
  if (existing) {
    return existing;
  }
  const node = {
    name: titleize(segment),
    type: 'dir',
    children: []
  };
  parent.children.push(node);
  return node;
}

function findFile(parent, fileName) {
  return ensureChildren(parent).find((child) => child.type === 'file' && child.file === fileName);
}

function sortNode(node) {
  if (!Array.isArray(node.children) || !node.children.length) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
  for (const child of node.children) {
    sortNode(child);
  }
}

function collectExistingFiles(node, target = new Set()) {
  if (!node) return target;
  if (node.type === 'file' && node.file) {
    target.add(node.file);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectExistingFiles(child, target);
    }
  }
  return target;
}

function parseSegments(fileNameStem) {
  return fileNameStem.split('_').filter(Boolean);
}

function buildDisplayName(fileSegments, extension) {
  if (!fileSegments.length) {
    return `${extension.toUpperCase()} sin título`;
  }
  const raw = fileSegments.join(' ');
  const cleaned = raw
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `${cleaned}${extension ? `.${extension}` : ''}` : `${extension.toUpperCase()} sin título`;
}

async function main() {
  let manifestRaw;
  try {
    manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo abrir ${MANIFEST_PATH}: ${error.message}`);
  }

  const manifest = JSON.parse(manifestRaw);
  const existingFiles = collectExistingFiles(manifest);

  let files;
  try {
    files = await fs.readdir(FILES_DIR);
  } catch (error) {
    throw new Error(`No se pudo listar la carpeta ${FILES_DIR}: ${error.message}`);
  }

  const createdEntries = [];
  const skipped = [];
  const warnings = [];

  for (const entry of files) {
    if (entry.startsWith('.')) continue;
    if (existingFiles.has(entry)) {
      skipped.push({ file: entry, reason: 'ya estaba en index.json' });
      continue;
    }

    const ext = path.extname(entry).slice(1).toLowerCase();
    const stem = path.basename(entry, path.extname(entry));
    const segments = parseSegments(stem);

    if (segments.length < pathDepth) {
      warnings.push({ file: entry, reason: `necesita al menos ${pathDepth + 1} segmentos (incluyendo el nombre del archivo)` });
      continue;
    }

    const dirSegments = segments.slice(0, pathDepth);
    const fileSegments = segments.slice(pathDepth);

    let pointer = manifest;
    for (const segment of dirSegments) {
      pointer = ensureDir(pointer, segment);
    }

    if (!pointer.children) {
      pointer.children = [];
    }

    if (findFile(pointer, entry)) {
      skipped.push({ file: entry, reason: 'ya existía en la carpeta destino' });
      continue;
    }

    const stats = await fs.stat(path.join(FILES_DIR, entry));
    const isoDate = stats.mtime.toISOString().slice(0, 10);
    const displayName = buildDisplayName(fileSegments.length ? fileSegments : [stem], ext);

    const node = {
      name: displayName,
      type: 'file',
      ext,
      file: entry,
      date: isoDate
    };

    pointer.children.push(node);
    createdEntries.push({ file: entry, path: [...dirSegments] });
  }

  sortNode(manifest);

  if (!dryRun) {
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  const logLines = [];
  logLines.push(`✔️ Procesados ${files.length} archivos en ${path.relative(PROJECT_ROOT, FILES_DIR)}`);
  if (createdEntries.length) {
    logLines.push('📁 Agregados al índice:');
    for (const item of createdEntries) {
      logLines.push(`  • ${item.file} → ${item.path.join(' / ')}`);
    }
  }
  if (skipped.length) {
    logLines.push('↩️ Omitidos:');
    for (const item of skipped) {
      logLines.push(`  • ${item.file} (${item.reason})`);
    }
  }
  if (warnings.length) {
    logLines.push('⚠️ Advertencias:');
    for (const item of warnings) {
      logLines.push(`  • ${item.file} (${item.reason})`);
    }
  }

  process.stdout.write(`${logLines.join('\n')}\n`);
}

main().catch((error) => {
  console.error(`❌ Error: ${error.message}`);
  process.exitCode = 1;
});
