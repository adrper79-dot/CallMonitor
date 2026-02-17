# Changelog

All notable changes to Word Is Bond will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Centralized logging system (`lib/logger.ts`) with environment-aware log levels
- Centralized configuration management (`lib/config.ts`) with validation
- Error boundary component for React error handling
- Security headers in Next.js configuration (HSTS, X-Frame-Options, etc.)
- Comprehensive `.env.example` file for onboarding
- `.gitignore` entries for `.next/` build artifacts
- CHANGELOG.md for tracking changes
- Outlook (Microsoft 365) OAuth integration routes: `/api/outlook/status|connect|callback|disconnect`
- Onboarding optional Email OAuth step (Gmail/Outlook) with SMS-only skip path
- OAuth callback pages for Google Workspace and Outlook to complete authorization in-app
- Integration migration `2026-02-16-add-outlook-provider-to-integrations.sql`

### Changed
- **BREAKING**: Enabled TypeScript strict mode in `tsconfig.json`
- **BREAKING**: Disabled `ignoreBuildErrors` in `next.config.js` - builds now fail on type errors
- Re-enabled webhook signature validation for SignalWire webhooks
- Improved error handling in root layout with ErrorBoundary
- Integration Hub calendar tab now supports both Google Workspace (Gmail) and Outlook providers
- Google Workspace connect endpoint now accepts optional OAuth `state` passthrough for return-to-flow redirects

### Fixed
- Removed `.next/` build artifacts from git tracking
- Fixed security vulnerability: webhook signature validation now enforced

### Security
- Added comprehensive security headers (HSTS, CSP, X-Frame-Options, etc.)
- Re-enabled webhook signature validation
- Improved environment variable handling with centralized config

## [Previous Releases]

### January 13, 2026 - Critical Fixes
- Fixed signup bug for user adrper792@gmail.com
- Fixed tool creation with correct schema
- Added voice_configs creation on signup
- Fixed recording storage with SignalWire authentication

### January 12, 2026 - Live Translation & Features
- Added live translation support (Business plan)
- Reorganized ARCH_DOCS into logical structure
- Added bulk upload feature
- Added test dashboard
- Improved navigation and settings UI

### January 11, 2026 - Security & RLS
- Added Row Level Security (RLS) policies
- Added login attempts tracking
- Improved authentication security

### January 10, 2026 - Voice Configuration
- Added voice_configs table
- Implemented call modulation settings

### January 9, 2026 - Call Tracking
- Added call_sid to calls table
- Improved call status tracking

---

## How to Update This Changelog

When making changes:

1. **Added** - New features
2. **Changed** - Changes in existing functionality
3. **Deprecated** - Soon-to-be removed features
4. **Removed** - Removed features
5. **Fixed** - Bug fixes
6. **Security** - Vulnerability fixes

Mark breaking changes with **BREAKING**.
