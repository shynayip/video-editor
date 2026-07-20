import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { test } from 'node:test';

const cssPath = new URL('../src/index.css', import.meta.url);

function getRuleBody(css, selector) {
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing rule for ${selector}`);
  return match[1];
}

test('workspace layout uses the approved horizontal ordering', async () => {
  const css = await readFile(cssPath, 'utf8');

  const workspace = getRuleBody(css, '.workspace');
  const detailsPanel = getRuleBody(css, '.details-panel');
  const mediaPanel = getRuleBody(css, '.media-panel');
  const mediaLibrary = getRuleBody(css, '.media-library');
  const previewPanel = getRuleBody(css, '.preview-panel');
  const previewShell = getRuleBody(css, '.preview-shell');
  const previewWindow = getRuleBody(css, '.preview-window');

  assert.match(workspace, /clamp\(240px, 19vw, 300px\)/);
  assert.match(workspace, /clamp\(250px, 22vw, 360px\)/);
  assert.match(workspace, /minmax\(480px, 1fr\)/);
  assert.match(workspace, /grid-template-areas:\s*"settings media preview";/);
  assert.match(detailsPanel, /grid-area:\s*settings;/);
  assert.match(detailsPanel, /border-right:\s*1px solid #26313c;/);
  assert.match(detailsPanel, /border-left:\s*0;/);
  assert.match(detailsPanel, /overflow-y:\s*auto;/);
  assert.match(mediaPanel, /grid-area:\s*media;/);
  assert.match(mediaLibrary, /overflow-y:\s*auto;/);
  assert.match(previewPanel, /grid-area:\s*preview;/);
  assert.match(previewShell, /width:\s*min\(100%, calc\(\(100cqh - 38px\) \* 9 \/ 16\)\);/);
  assert.match(previewWindow, /aspect-ratio:\s*9\s*\/\s*16;/);
  assert.doesNotMatch(previewShell, /\* 16 \/ 9\);/);
  assert.doesNotMatch(previewWindow, /aspect-ratio:\s*16\s*\/\s*9;/);
  assert.doesNotMatch(previewShell, /600px/);
});
