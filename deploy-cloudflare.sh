#!/bin/bash

# Cloudflare Pages Deploy Script for wordisbond
# Builds the Next.js app with open-next and deploys to Cloudflare Pages

set -e  # Exit on any error

echo "Building Next.js app for Cloudflare Pages..."
npm run build:cloudflare

echo "Publishing to Cloudflare Pages..."
wrangler pages deploy .open-next/assets --project-name wordisbond

echo "Deployment complete! Check https://wordisbond.pages.dev"