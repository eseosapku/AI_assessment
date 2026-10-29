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
    'pdfjs-dist',
    'pg',
  ],
  // The Cambridge paper style is read with fs at request time, so the tracer
  // does not see the JSON. Without this include, a deployed build has the
  // route and none of the papers, and every Cambridge quiz is generated
  // with no past-paper style.
  outputFileTracingIncludes: {
    '/api/generate-assessment': ['./systems/cambridge/style/**/*'],
  },
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
      //
      // These patterns match ANYWHERE in a path, node_modules included: a
      // "./lib/**/*" meant for the project's sources also took pg/lib, and
      // every route that touches the database failed in production (HTTP 500,
      // 2026-10-07). Only patterns no installed package can match.
      './public/art/**/*',
      './data/textbook-images/manifest.json',
      './data/textbook-images/vision-descriptions.json',
      // The old picture library's index and its descriptions (32 MB). On the
      // server its images are never on disk (public/textbook-images is left
      // out above), so lib/textbook-source-images.ts keeps none of them and
      // both readers fall back to empty when the files are absent.
      './data/textbook-images/manifest.curated.json',
      './data/textbook-images/vision-cache.json',
    ],
  },
}

module.exports = nextConfig
