#!/usr/bin/env node
/**
 * Upload public/textbook-images and public/exam-images to the figures bucket
 * created by infra/cdn/template.yaml.
 *
 *   node scripts/upload-figures.mjs --dry-run      list what would upload
 *   node scripts/upload-figures.mjs                upload new and changed files
 *   node scripts/upload-figures.mjs --invalidate   ...then clear CloudFront's copy
 *
 * Options: --stack <name> (default studysquare-figures), --region <r> (default
 * eu-west-1), --profile <p>. Needs the AWS CLI v2.
 *
 * Upload a figure BEFORE pushing the JSON that points at it, or quizzes show
 * a broken image until it arrives. Never deletes from the bucket: saved quizzes
 * and recall cards keep pointing at figures that a bank no longer lists.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const FOLDERS = ['textbook-images', 'exam-images']
// The browser keeps a figure a day; CloudFront keeps it a year and is told
// when one changes (--invalidate). A figure re-cropped in place under the same
// name would otherwise be stale in learners' browsers for a year.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const stack = option('stack', 'studysquare-figures')
const region = option('region', 'eu-west-1')
const profile = option('profile', '')
const common = ['--region', region, ...(profile ? ['--profile', profile] : [])]

function aws(cmd, { capture = false } = {}) {
  const result = spawnSync('aws', [...cmd, ...common], {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  })
  if (result.error) {
    console.error('Could not run the AWS CLI. Install it: https://aws.amazon.com/cli/')
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
  return capture ? result.stdout.trim() : ''
}

function stackOutput(key) {
  const value = aws([
    'cloudformation', 'describe-stacks', '--stack-name', stack,
    '--query', `Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue`, '--output', 'text',
  ], { capture: true })
  if (!value || value === 'None') {
    console.error(`Stack ${stack} has no ${key} output. Deploy infra/cdn/template.yaml first.`)
    process.exit(1)
  }
  return value
}

const bucket = stackOutput('BucketName')
const distribution = stackOutput('DistributionId')
const root = path.join(process.cwd(), 'public')

for (const folder of FOLDERS) {
  const local = path.join(root, folder)
  if (!existsSync(local)) {
    console.log(`skip ${folder}: not on this machine`)
    continue
  }
  console.log(`${flag('dry-run') ? 'would sync' : 'syncing'} public/${folder} -> s3://${bucket}/${folder}`)
  aws([
    's3', 'sync', local, `s3://${bucket}/${folder}`,
    '--exclude', '.gitkeep',
    '--cache-control', CACHE_CONTROL,
    '--only-show-errors',
    ...(flag('dry-run') ? ['--dryrun'] : []),
  ])
}

if (flag('invalidate') && !flag('dry-run')) {
  aws([
    'cloudfront', 'create-invalidation', '--distribution-id', distribution,
    '--paths', ...FOLDERS.map((f) => `/${f}/*`),
  ])
}

console.log(`Figure base URL: ${stackOutput('FigureBaseUrl')}`)
