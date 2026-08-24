/**
 * The actual AWS bill.
 *
 * Imported from a Cost Explorer export rather than measured live — there is no
 * API credential in this application and no reason to give it one, so these are
 * a snapshot and carry the date they were taken. Re-export and replace the
 * table when the figures matter again.
 *
 * The reason this file exists at all is that the previous version of the cost
 * panel guessed at infrastructure, and the guess was wrong by a factor of three
 * in one direction while the inference estimate was wrong by a factor of five
 * in the other. Both are now real.
 *
 * Two findings worth carrying forward. Inference is 4.9% of the bill and the
 * database alone is 63%, so the cost of this platform is storing and serving
 * data, not generating it. And spend does not track usage: July cost more than
 * any other month while almost nobody was using the product, because most of
 * the bill is provisioned rather than consumed.
 */

export const AWS_COST_SOURCE = {
  /** When the export was taken. */
  exportedOn: '2026-08-24',
  periodFrom: '2026-02',
  periodTo: '2026-07',
  note: 'Cost Explorer export, service breakdown, monthly granularity.',
} as const

/**
 * What each service is for.
 *
 * The split that matters is between serving students and building the product.
 * CI, the container registry and the one-off model benchmark are the cost of
 * development and would not disappear if every student left, so folding them
 * into a cost-per-student would overstate what a student costs.
 */
export type CostBucket = 'serving' | 'inference' | 'development'

export const SERVICE_BUCKETS: Record<string, CostBucket> = {
  'Relational Database Service': 'serving',
  VPC: 'serving',
  Lambda: 'serving',
  Amplify: 'serving',
  CloudWatch: 'serving',
  'Secrets Manager': 'serving',
  'Key Management Service': 'serving',
  'Route 53': 'serving',
  SQS: 'serving',
  S3: 'serving',
  'API Gateway': 'serving',
  'Data Transfer': 'serving',
  // Watches production, so it is a cost of running it rather than of building it.
  'DevOps Guru': 'serving',

  Bedrock: 'inference',

  // Build and release, plus the experiments. The Haiku line is a single month's
  // benchmark and Rekognition is the vision-curation pass — neither is spent on
  // teaching anybody.
  'EC2 Container Registry (ECR)': 'development',
  CodeBuild: 'development',
  CodePipeline: 'development',
  'Claude Haiku 4.5 ( Bedrock Edition)': 'development',
  Rekognition: 'development',
  Glue: 'development',
  CloudShell: 'development',
  CloudFormation: 'development',
}

export interface AwsMonth {
  month: string
  total: number
  byService: Record<string, number>
}

/** Monthly spend by service, USD, straight from the export. */
export const AWS_MONTHS: AwsMonth[] = [
  {
    month: '2026-02',
    total: 3.8582539253,
    byService: {
      'Relational Database Service': 2.8679352178,
      VPC: 0.6,
      'EC2 Container Registry (ECR)': 0.100670892,
      'Secrets Manager': 0.142857144,
      CodeBuild: 0.11,
      Amplify: 0.0360533942,
      S3: 0.0007372773,
    },
  },
  {
    month: '2026-03',
    total: 22.8844181648,
    byService: {
      'Relational Database Service': 14.1371386287,
      VPC: 3,
      Lambda: 0.0704784756,
      Bedrock: 0.992873281,
      'EC2 Container Registry (ECR)': 0.951870126,
      'Secrets Manager': 0.6662163896,
      CodeBuild: 2.67,
      Amplify: 0.1366850033,
      CloudWatch: 0.0820315515,
      'Key Management Service': 0.001164,
      CodePipeline: 0.148,
      S3: 0.0091293027,
      'API Gateway': 0.0058336056,
      Rekognition: 0.013,
      'Data Transfer': -0.0000021992,
    },
  },
  {
    month: '2026-04',
    total: 25.0943124218,
    byService: {
      'Relational Database Service': 17.0857223637,
      VPC: 3.6,
      Lambda: 0.0387592252,
      Bedrock: 0.70305151,
      'EC2 Container Registry (ECR)': 2.3553634776,
      'Secrets Manager': 0.803425064,
      CodeBuild: 0.36,
      Amplify: 0.0327135391,
      CloudWatch: 0.0918397436,
      'Key Management Service': 0.00018,
      S3: 0.0172576385,
      'API Gateway': 0.0053778601,
      Glue: 0.000622,
    },
  },
  {
    month: '2026-05',
    total: 34.0553827668,
    byService: {
      'Relational Database Service': 17.5244676049,
      VPC: 3.72,
      Lambda: 0.3652374815,
      Bedrock: 5.28914631,
      'EC2 Container Registry (ECR)': 2.5099622341,
      'Secrets Manager': 0.8040299872,
      CodeBuild: 0.51,
      'Claude Haiku 4.5 ( Bedrock Edition)': 2.977013,
      Amplify: 0.1724587818,
      CloudWatch: 0.1011140299,
      'Key Management Service': 0.000297,
      CodePipeline: 0.038,
      S3: 0.0181711482,
      'API Gateway': 0.0248031892,
      Glue: 0.000682,
    },
  },
  {
    month: '2026-06',
    total: 68.7007516707,
    byService: {
      'Relational Database Service': 44.4245570829,
      VPC: 5.297912505,
      Lambda: 7.055737098,
      Bedrock: 3.699820356,
      'EC2 Container Registry (ECR)': 2.738763936,
      'Secrets Manager': 1.1890637479,
      'DevOps Guru': 1.50788,
      CodeBuild: 0.02,
      Amplify: 1.8321015763,
      CloudWatch: 0.741719309,
      'Key Management Service': 0.000582,
      'Route 53': 0.1,
      SQS: 0.0517288171,
      S3: 0.0195541477,
      'API Gateway': 0.0205760297,
      Glue: 0.000755,
      CloudShell: 0.0000000651,
    },
  },
  {
    month: '2026-07',
    total: 92.2840608486,
    byService: {
      'Relational Database Service': 59.1869805138,
      VPC: 7.44,
      Lambda: 15.4308227335,
      Bedrock: 1.485210612,
      'EC2 Container Registry (ECR)': 2.7387639936,
      'Secrets Manager': 1.6302799808,
      'DevOps Guru': 3.1248,
      Amplify: 0.5590393337,
      CloudWatch: 0.2067151244,
      'Key Management Service': 0.244713652,
      'Route 53': 0.1,
      SQS: 0.1139612,
      S3: 0.0195844122,
      'API Gateway': 0.0031892926,
    },
  },
]

/** Lifetime spend per service across the exported period. */
export function serviceTotals(): { service: string; usd: number; bucket: CostBucket }[] {
  const totals = new Map<string, number>()
  for (const m of AWS_MONTHS) {
    for (const [service, usd] of Object.entries(m.byService)) {
      totals.set(service, (totals.get(service) ?? 0) + usd)
    }
  }
  return [...totals.entries()]
    .map(([service, usd]) => ({
      service,
      usd: Math.round(usd * 100) / 100,
      // An unrecognised service is treated as a cost of serving rather than
      // dropped, so a new line on the bill can never quietly vanish from the
      // total it belongs to.
      bucket: SERVICE_BUCKETS[service] ?? 'serving',
    }))
    .sort((a, b) => b.usd - a.usd)
}

/** Spend for one month, split by what it was for. */
export function bucketsForMonth(month: AwsMonth): Record<CostBucket, number> {
  const out: Record<CostBucket, number> = { serving: 0, inference: 0, development: 0 }
  for (const [service, usd] of Object.entries(month.byService)) {
    out[SERVICE_BUCKETS[service] ?? 'serving'] += usd
  }
  return out
}
