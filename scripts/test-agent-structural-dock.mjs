import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const css=fs.readFileSync('artifacts/bimlog/src/index.css','utf8');
const app=fs.readFileSync('artifacts/bimlog/src/App.tsx','utf8');
assert.equal((app.match(/<PageAssistant\b/g)||[]).length,1);
assert.match(app, /<PageAssistant key=\{assistantAccount \?\? "signed-out"\}/);
assert.match(app,/bimlog-workspace-split/);
assert.match(css,/\.bimlog-workspace-content\{[^}]*contain:layout/);
assert.doesNotMatch(css,/bimlog-assistant-docked[^{}]*#root/);
assert.doesNotMatch(css,/\.page-assistant-panel(?:\[[^\]]*\])?\{[^}]*position:(?:fixed|absolute)/);
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>*{box-sizing:border-box}body{margin:0}.sidebar{width:220px}.main-area{min-width:0;flex:1}header.topbar{height:52px}</style><div id="root"><div class="bimlog-workspace-split"><div class="bimlog-workspace-content"><header class="topbar">BIMLog geometry fixture — synthetic only</header><main><div class="app-shell"><aside class="sidebar">Navigation</aside><div class="main-area">Project workspace</div></div></main></div><div data-page-assistant data-page-assistant-open="false"><aside class="page-assistant-panel" hidden><header>Agent</header></aside></div></div></div><script>
window.runDockGeometry=()=>{const results=[];const host=document.querySelector('[data-page-assistant]'),panel=document.querySelector('.page-assistant-panel'),content=document.querySelector('.bimlog-workspace-content'),shell=document.querySelector('.app-shell');
for(const side of ['left','right'])for(const collapsed of [false,true])for(const width of [320,352,Math.min(680,Math.max(320,innerWidth-320))]){document.body.className='bimlog-assistant-docked';document.body.dataset.assistantDockSide=side;document.body.dataset.assistantCollapsed=String(collapsed);document.documentElement.style.setProperty('--bimlog-agent-dock-width',width+'px');host.dataset.pageAssistantOpen='true';panel.hidden=false;panel.style.display="flex";panel.dataset.dock=side;panel.dataset.collapsed=String(collapsed);const p=panel.getBoundingClientRect(),s=shell.getBoundingClientRect();const mobile=innerWidth<=760;const pass=mobile?p.width===innerWidth&&getComputedStyle(content).display==='none':Math.abs(s.width+p.width-innerWidth)<2&&(side==='right'?s.right<=p.left+1:p.right<=s.left+1)&&getComputedStyle(panel).position==='sticky';results.push({side,collapsed,width,viewport:innerWidth,shellWidth:s.width,panelWidth:p.width,pass});}
document.body.className='';delete document.body.dataset.assistantDockSide;delete document.body.dataset.assistantCollapsed;host.dataset.pageAssistantOpen='false';panel.hidden=true;panel.style.display="none";results.push({closed:true,pass:Math.abs(shell.getBoundingClientRect().width-innerWidth)<2});return results;};</script>`;
const output=process.argv[2]||path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bimlog-dock-')),'geometry.html');fs.writeFileSync(path.resolve(output),html);console.log('STRUCTURAL_DOCK_SOURCE=PASS fixture='+output);

