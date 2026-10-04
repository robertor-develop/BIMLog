export type BillingAuthorityClient={query(text:string,values?:readonly unknown[]):Promise<{rows:Record<string,unknown>[]}>};
export type CommercialBillingAuthority=Readonly<{userId:number;companyId:number;role:"billing_admin"|"viewer";canManageBilling:boolean}>;

function positive(value:unknown,label:string){if(!Number.isSafeInteger(value)||Number(value)<1)throw new Error(`${label} is invalid`);return Number(value);}

export async function resolveCommercialBillingAuthority(client:BillingAuthorityClient,input:{userId:number;companyId:number}):Promise<CommercialBillingAuthority>{
  const userId=positive(input.userId,"User identity"),companyId=positive(input.companyId,"Company identity");
  const result=await client.query(`SELECT u.id,u.company_id,u.is_super_admin,
    EXISTS(SELECT 1 FROM financial_authority_grants g
      WHERE g.user_id=u.id AND g.company_id=u.company_id AND g.authority='financial_administrator'
        AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now())
        AND NOT EXISTS(SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id)) AS is_financial_administrator
    FROM users u WHERE u.id=$1 AND u.company_id=$2 LIMIT 1`,[userId,companyId]);
  const row=result.rows[0];
  if(!row||Number(row.id)!==userId||Number(row.company_id)!==companyId)throw new Error("Authenticated billing identity is unavailable");
  const canManageBilling=row.is_super_admin===true||row.is_financial_administrator===true;
  return Object.freeze({userId,companyId,role:canManageBilling?"billing_admin":"viewer",canManageBilling});
}

export function requireCommercialBillingManager(authority:CommercialBillingAuthority){
  if(!authority.canManageBilling||authority.role!=="billing_admin")throw new Error("Billing administrator authority is required");
  return authority;
}
