import {spawnSync} from "node:child_process";
type OwnedProcess={id:number;created:string};
export function snapshotOwnedFixtureBrowser(rootPid:number|undefined):OwnedProcess[]{
 if(process.platform!=="win32"||!rootPid)return [];
 const command=`$ErrorActionPreference='Stop';$all=@(Get-CimInstance Win32_Process);$ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add([int]$env:BIMLOG_FIXTURE_ROOT_PID);do{$changed=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and $ids.Add([int]$p.ProcessId)){$changed=$true}}}while($changed);@($all|Where-Object{$ids.Contains([int]$_.ProcessId)-and $_.Name -eq 'msedge.exe'}|ForEach-Object{@{id=[int]$_.ProcessId;created=$_.CreationDate.ToUniversalTime().ToString('o')}})|ConvertTo-Json -Compress`;
 const result=spawnSync("powershell.exe",["-NoProfile","-Command",command],{env:{...process.env,BIMLOG_FIXTURE_ROOT_PID:String(rootPid)},windowsHide:true,encoding:"utf8"});
 if(result.status!==0)throw Error("Owned fixture process snapshot failed: "+result.stderr);
 if(!result.stdout.trim())return [];const raw=JSON.parse(result.stdout);const rows=Array.isArray(raw)?raw:[raw];
 if(!rows.every(row=>Number.isSafeInteger(row.id)&&row.id>0&&typeof row.created==="string"))throw Error("Invalid owned fixture process snapshot");return rows;
}
export function releaseOwnedFixtureBrowser(rows:OwnedProcess[]){
 if(process.platform!=="win32"||rows.length===0)return;
 const command=`$ErrorActionPreference='Stop';$ownedRows=$env:BIMLOG_FIXTURE_PROCESS_ROWS|ConvertFrom-Json;foreach($owned in $ownedRows){$idToCheck=[int]$owned.id;$p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$idToCheck);if($p -and $p.Name -eq 'msedge.exe' -and $p.CreationDate.ToUniversalTime().ToString('o') -eq [string]$owned.created){try{Stop-Process -Id $idToCheck -Force -ErrorAction Stop}catch{$remaining=Get-CimInstance Win32_Process -Filter ("ProcessId="+$idToCheck);if($remaining -and $remaining.CreationDate.ToUniversalTime().ToString('o') -eq [string]$owned.created){throw}}}};foreach($owned in $ownedRows){$p=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$owned.id);if($p -and $p.Name -eq 'msedge.exe' -and $p.CreationDate.ToUniversalTime().ToString('o') -eq [string]$owned.created){throw 'Owned fixture browser process did not exit'}}`;

 const result=spawnSync("powershell.exe",["-NoProfile","-Command",command],{env:{...process.env,BIMLOG_FIXTURE_PROCESS_ROWS:JSON.stringify(rows)},windowsHide:true,encoding:"utf8"});
 if(result.status!==0)throw Error("Owned fixture process release failed: "+result.stderr);
}
