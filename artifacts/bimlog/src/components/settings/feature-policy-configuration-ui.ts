export function updatePolicyConfiguration(current:Record<string,string>,key:string,value:string){const next={...current};if(value)next[key]=value;else delete next[key];return next;}
