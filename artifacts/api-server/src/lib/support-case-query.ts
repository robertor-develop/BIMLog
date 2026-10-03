export type SupportCaseListQuery=Readonly<{search:string;workload:""|"urgent"|"waiting"|"resolved";assignment:""|"mine"|"unassigned";overdue:boolean;limit:number;offset:number}>;

export function parseSupportCaseListQuery(query:Record<string,unknown>):SupportCaseListQuery{
 const search=typeof query.search==="string"?query.search.trim():"";
 if(search.length>120)throw new Error("SUPPORT_CASE_SEARCH_INVALID");
 const workload=typeof query.workload==="string"?query.workload.trim():"";
 if(workload!==""&&workload!=="urgent"&&workload!=="waiting"&&workload!=="resolved")throw new Error("SUPPORT_CASE_WORKLOAD_INVALID");
 const assignment=typeof query.assignment==="string"?query.assignment.trim():"";
 if(assignment!==""&&assignment!=="mine"&&assignment!=="unassigned")throw new Error("SUPPORT_CASE_ASSIGNMENT_SCOPE_INVALID");
 const overdue=query.overdue===undefined||query.overdue===""?false:query.overdue==="true";
 if(query.overdue!==undefined&&query.overdue!==""&&query.overdue!=="true"&&query.overdue!=="false")throw new Error("SUPPORT_CASE_OVERDUE_INVALID");
 const limit=query.limit===undefined?25:Number(query.limit),offset=query.offset===undefined?0:Number(query.offset);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("SUPPORT_CASE_LIMIT_INVALID");
 if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new Error("SUPPORT_CASE_OFFSET_INVALID");
 return Object.freeze({search,workload:workload as SupportCaseListQuery["workload"],assignment:assignment as SupportCaseListQuery["assignment"],overdue,limit,offset});
}
