import type { NextFunction, Request, Response } from "express";

type RateLimitOptions={operation:string;limit:number;windowMs:number;now?:()=>number};
type Bucket={count:number;resetAt:number};

export function createTeamResourceMutationRateLimit(options:RateLimitOptions){
  const buckets=new Map<string,Bucket>();
  const now=options.now??Date.now;
  return (req:Request&{user?:{userId?:unknown}},res:Response,next:NextFunction)=>{
    const timestamp=now();
    const actor=String(req.user?.userId??"unauthenticated");
    const project=String(req.params?.projectId??"unknown");
    const key=`${options.operation}:${actor}:${project}`;
    let bucket=buckets.get(key);
    if(!bucket||timestamp>=bucket.resetAt){bucket={count:0,resetAt:timestamp+options.windowMs};buckets.set(key,bucket);}
    bucket.count+=1;
    const remaining=Math.max(0,options.limit-bucket.count);
    res.setHeader("RateLimit-Limit",String(options.limit));
    res.setHeader("RateLimit-Remaining",String(remaining));
    res.setHeader("RateLimit-Reset",String(Math.ceil(bucket.resetAt/1000)));
    if(bucket.count>options.limit){
      const retryAfter=Math.max(1,Math.ceil((bucket.resetAt-timestamp)/1000));
      res.setHeader("Retry-After",String(retryAfter));
      res.status(429).json({code:"TEAM_RESOURCE_RATE_LIMITED",error:"Too many resource-planning changes. Try again after the current rate-limit window."});
      return;
    }
    if(buckets.size>10000) for(const [bucketKey,value] of buckets) if(timestamp>=value.resetAt)buckets.delete(bucketKey);
    next();
  };
}
