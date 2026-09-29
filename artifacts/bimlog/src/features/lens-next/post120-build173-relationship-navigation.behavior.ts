import assert from "node:assert/strict";
import { lensNextLinkedItemHref } from "./lens-next-relationship-navigation.ts";
const issue={identity:{projectId:35,serverId:77,viewpointId:"vp-77",revisionNumber:4}} as any;
const href=lensNextLinkedItemHref(issue,{linkId:1,type:"rfi",authoritativeId:9,displayId:"RFI-009",title:"Sleeve"});
assert.match(href,/\/projects\/35\/rfis\/9/); assert.match(decodeURIComponent(href),/projectId=35/); assert.match(decodeURIComponent(href),/issueId=77/); assert.match(decodeURIComponent(href),/revision=4/);
console.log("PASS UX063 exact Lens relationship navigation");
