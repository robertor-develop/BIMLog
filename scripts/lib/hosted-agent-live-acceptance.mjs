const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;

export function verifyReleaseIdentity(receipt){
  const errors=[];
  if(receipt?.status!=="ok")errors.push("health-status");
  if(!SHA.test(receipt?.sourceCommit||""))errors.push("source-commit");
  if(!DIGEST.test(receipt?.assetManifestSha256||""))errors.push("asset-manifest");
  if(typeof receipt?.packageId!=="string"||!receipt.packageId.includes((receipt.sourceCommit||"").slice(0,16)))errors.push("package-source");
  if(receipt?.identityBound!==true)errors.push("identity-bound");
  return Object.freeze({pass:errors.length===0,errors:Object.freeze(errors)});
}
