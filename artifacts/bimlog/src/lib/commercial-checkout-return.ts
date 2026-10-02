export type CommercialCheckoutReturn="success"|"cancelled"|null;

export function parseCommercialCheckoutReturn(search:string):CommercialCheckoutReturn{
  const value=new URLSearchParams(search).get("checkout");
  return value==="success"||value==="cancelled"?value:null;
}
