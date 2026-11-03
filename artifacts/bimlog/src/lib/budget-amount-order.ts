/** Compare canonical six-decimal amounts without rounding them through Number. */
export function compareBudgetAmounts(left:unknown,right:unknown):number{
 const parse=(value:unknown)=>{const match=/^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(String(value??"0"));return match?(BigInt(match[2])*1000000n+BigInt((match[3]??"").padEnd(6,"0")))*(match[1]? -1n:1n):null;};
 const a=parse(left),b=parse(right);return a===null||b===null?0:a<b?-1:a>b?1:0;
}
