import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";
import { waitForTeamResourcePlanningMigration } from "../lib/team-resource-planning-migration";

type RateLimitOptions={operation:string;limit:number;windowMs:number;now?:()=>number;persistence?:"database"|"memory"};
type Bucket={count:number;resetAt:number};

export function createTeamResourceMutationRateLimit(options:RateLimitOptions){
  const buckets=new Map<string,Bucket>();
  const now=options.now??Date.now;
  return async (req:Request&{user?:{userId?:unknown}},res:Response,next:NextFunction)=>{
    const timestamp=now();
    const actor=String(req.user?.userId??"unauthenticated");
    const project=String(req.params?.projectId??"unknown");
    const key=`${options.operation}:${actor}:${project}`;
    let bucket:Bucket;
    if(options.persistence==="memory"){
      bucket=buckets.get(key)??{count:0,resetAt:timestamp+options.windowMs};
      if(timestamp>=bucket.resetAt)bucket={count:0,resetAt:timestamp+options.windowMs};
      bucket.count+=1;buckets.set(key,bucket);
    }else{
      try{
        await waitForTeamResourcePlanningMigration();
        const result=await pool.query(`INSERT INTO team_resource_mutation_rate_limits(bucket_key,window_started_at,request_count,expires_at)
          VALUES($1,to_timestamp($2/1000.0),1,to_timestamp(($2+$3)/1000.0))
          ON CONFLICT(bucket_key) DO UPDATE SET
            window_started_at=CASE WHEN team_resource_mutation_rate_limits.expires_at<=to_timestamp($2/1000.0) THEN to_timestamp($2/1000.0) ELSE team_resource_mutation_rate_limits.window_started_at END,
            request_count=CASE WHEN team_resource_mutation_rate_limits.expires_at<=to_timestamp($2/1000.0) THEN 1 ELSE team_resource_mutation_rate_limits.request_count+1 END,
            expires_at=CASE WHEN team_resource_mutation_rate_limits.expires_at<=to_timestamp($2/1000.0) THEN to_timestamp(($2+$3)/1000.0) ELSE team_resource_mutation_rate_limits.expires_at END
          RETURNING request_count "count",extract(epoch from expires_at)*1000 "resetAt"`,[key,timestamp,options.windowMs]);
        bucket={count:Number(result.rows[0].count),resetAt:Number(result.rows[0].resetAt)};
      }catch(error){
        console.error("[team-resource-planning] shared rate limit failed",error);
        res.status(503).json({code:"TEAM_RESOURCE_RATE_LIMIT_UNAVAILABLE",error:"Resource-planning changes are temporarily unavailable."});
        return;
      }
    }
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
    if(options.persistence==="memory"&&buckets.size>10000) for(const [bucketKey,value] of buckets) if(timestamp>=value.resetAt)buckets.delete(bucketKey);
    next();
  };
}
