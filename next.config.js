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
    ],
  },
}

module.exports = nextConfig
