/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sqs',
    'pdf-parse',
    'pg',
  ],
  outputFileTracingExcludes: {
    '*': [
      './public/textbook-images/**/*',
      './public/exam-images/**/*',
      // The figure pipeline's inputs and records: read by scripts, never by
      // the app. The route reads data/ by computed paths, so the whole folder
      // is traced unless told otherwise, and the Rwanda figures added 31 MB.
      './data/*.raw.json',
      './data/*tags.json',
      './data/figure-topic-check.json',
      './data/scanned-toc-proposals.json',
      './data/cambridge-textbook-pdf-map.json',
      './data/figure-drafts/**/*',
      './data/audit/**/*',
    ],
  },
}

module.exports = nextConfig
