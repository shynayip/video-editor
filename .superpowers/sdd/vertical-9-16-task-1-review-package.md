# Commits

a5ef916 feat: use vertical 9:16 preview canvas

# Stat

 video-editor/src/index.css                   | 4 ++--
 video-editor/tests/workspace-layout.test.mjs | 6 ++++--
 2 files changed, 6 insertions(+), 4 deletions(-)

# Diff

diff --git a/video-editor/src/index.css b/video-editor/src/index.css
index eb97881..06b5614 100644
--- a/video-editor/src/index.css
+++ b/video-editor/src/index.css
@@ -855,28 +855,28 @@ button {
   padding: 14px 16px;
   overflow: visible;
   background:
     linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
     linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), #171d26;
   background-size: 32px 32px;
 }
 
 .preview-shell {
   position: relative;
-  width: min(100%, calc((100cqh - 38px) * 16 / 9));
+  width: min(100%, calc((100cqh - 38px) * 9 / 16));
   padding-top: 38px;
 }
 
 .preview-window {
   position: relative;
   width: 100%;
-  aspect-ratio: 16 / 9;
+  aspect-ratio: 9 / 16;
   overflow: hidden;
   background: #020617;
   border: 1px solid #334155;
   border-radius: 8px;
   box-shadow: 0 20px 52px rgba(0, 0, 0, 0.38);
 }
 
 .manual-crop-frame {
   position: absolute;
   z-index: 90;
diff --git a/video-editor/tests/workspace-layout.test.mjs b/video-editor/tests/workspace-layout.test.mjs
index 95087dd..b4b3f90 100644
--- a/video-editor/tests/workspace-layout.test.mjs
+++ b/video-editor/tests/workspace-layout.test.mjs
@@ -26,14 +26,16 @@ test('workspace layout uses the approved horizontal ordering', async () => {
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
-  assert.match(previewShell, /width:\s*min\(100%, calc\(\(100cqh - 38px\) \* 16 \/ 9\)\);/);
-  assert.match(previewWindow, /aspect-ratio:\s*16\s*\/\s*9;/);
+  assert.match(previewShell, /width:\s*min\(100%, calc\(\(100cqh - 38px\) \* 9 \/ 16\)\);/);
+  assert.match(previewWindow, /aspect-ratio:\s*9\s*\/\s*16;/);
+  assert.doesNotMatch(previewShell, /\* 16 \/ 9\);/);
+  assert.doesNotMatch(previewWindow, /aspect-ratio:\s*16\s*\/\s*9;/);
   assert.doesNotMatch(previewShell, /600px/);
 });
