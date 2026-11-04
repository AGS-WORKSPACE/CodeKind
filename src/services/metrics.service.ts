import{api}from'./api';

export type MetricsTotals={gmv:number;netRevenue:number;takeRateBps:number;sessions:number;completed:number;cancelled:number;cancelRateBps:number;learners:number;repeatLearners:number;repeatRateBps:number;avgSession:number};
export type MetricsSupply={profiles:number;draft:number;submitted:number;approved:number;rejected:number;activated:number;daysToApproval:number;daysToFirstLesson:number};
export type MetricsMonth={month:string;newLearners:number;newTutors:number;approvedTutors:number;sessions:number;activeTutors:number;activeLearners:number;gmv:number;netRevenue:number};
export type MetricsCohort={month:string;learners:number;m1:number;m2:number;m3:number};
export type MetricsOverview={currency:string;months:number;totals:MetricsTotals;supply:MetricsSupply;series:MetricsMonth[];cohorts:MetricsCohort[];currencies:string[]};

/* The business view of the platform, read straight from the live tables. Money is in minor units
   and in one currency: the busiest one, since totalling dollars and naira would be a lie. */
export const metricsService={
 overview:(months=12)=>api<MetricsOverview>(`/admin/metrics?months=${months}`),
};
