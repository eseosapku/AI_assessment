/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server source maps were 37 MB of the 50 MB server output, and Amplify
  // counts them against its 220 MB build-output limit (it rejected a 280 MB
  // build). Production stack traces point at compiled code instead.
  experimental: {
    serverSourceMaps: false,
  },
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
      // The rest of public/ (served by the CDN, never read by the server),
      // the docs, the migrations and the notes. With them the server bundle
      // reached 224 MB against Amplify's 220 MB, and every build from
      // 2026-10-06 failed while the site kept serving a September build.
      // Not scripts/: app/api/exam-sources runs one at runtime.
      './public/**/*',
      './docs/**/*',
      './migrations/**/*',
      './*.md',
      // The old library's uncurated manifest (read only when the curated one
      // is missing) and the vision-description records (read by scripts).
      './data/textbook-images/manifest.json',
      './data/textbook-images/vision-descriptions.json',
      // Sources the build has already compiled into .next/server.
      './lib/**/*',
      './app/**/*',
      './components/**/*',
    ],
  },
}

module.exports = nextConfig
