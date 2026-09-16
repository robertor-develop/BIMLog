import assert from "node:assert/strict";
import { DEFAULT_LENS_NEXT_WORKSPACE_LAYOUT, normalizeLensNextWorkspaceLayout, readLensNextWorkspaceLayout, writeLensNextWorkspaceLayout } from "./lens-next-workspace-layout";
assert.deepEqual(normalizeLensNextWorkspaceLayout(null),DEFAULT_LENS_NEXT_WORKSPACE_LAYOUT);
assert.deepEqual(normalizeLensNextWorkspaceLayout({filtersWidth:1,listWidth:9999,filtersCollapsed:true,listCollapsed:false}),{filtersWidth:180,listWidth:640,filtersCollapsed:true,listCollapsed:false});
let saved="";writeLensNextWorkspaceLayout({setItem:(_key,value)=>{saved=value;}},{filtersWidth:260,listWidth:500,filtersCollapsed:false,listCollapsed:true});
assert.deepEqual(readLensNextWorkspaceLayout({getItem:()=>saved}),{filtersWidth:260,listWidth:500,filtersCollapsed:false,listCollapsed:true});
assert.deepEqual(readLensNextWorkspaceLayout({getItem:()=>"{"}),DEFAULT_LENS_NEXT_WORKSPACE_LAYOUT);
console.log("lens-next-workspace-layout: PASS");
