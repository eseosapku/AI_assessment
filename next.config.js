/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
  serverRuntimeConfig: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
}

module.exports = nextConfig
