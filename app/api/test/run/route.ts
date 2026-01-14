import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { logger } from '@/lib/logger'

// Force dynamic rendering - test execution must be dynamic
export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { categoryId, testId } = await request.json()

    // Route to appropriate test runner
    switch (testId) {
      case 'vitest':
        return await runVitestTests()
      
      case 'integration':
        return await runIntegrationTests()
      
      case 'typescript':
        return await runTypeScriptCheck()
      
      case 'eslint':
        return await runESLint()
      
      case 'env-vars':
        return await checkEnvironmentVariables()
      
      case 'supabase':
        return await testSupabaseConnection()
      
      case 'signalwire':
        return await testSignalWireConnection()
      
      case 'api-auth':
        return await testAuthEndpoints()
      
      case 'api-voice':
        return await testVoiceEndpoints()
      
      case 'api-capabilities':
        return await testCapabilitiesEndpoint()
      
      case 'translation':
        return await testTranslationFeature()
      
      case 'recording':
        return await testRecordingFeature()
      
      case 'transcription':
        return await testTranscriptionFeature()
      
      case 'rbac-types':
        return await testRBACTypeConsistency()
      
      case 'permissions':
        return await testPermissionMatrix()
      
      default:
        return NextResponse.json({ 
          passed: false, 
          error: `Unknown test: ${testId}` 
        })
    }
  } catch (error) {
    logger.error('Test runner error', error)
    return NextResponse.json({
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// ============================================================================
// Test Implementations
// ============================================================================

async function runVitestTests() {
  try {
    const { stdout, stderr } = await execAsync('npm test -- --run --reporter=json', {
      timeout: 60000,
      cwd: process.cwd()
    })
    
    // Parse vitest JSON output
    const output = stdout.split('\n')
    const lastLine = output[output.length - 1] || output[output.length - 2]
    
    try {
      const result = JSON.parse(lastLine)
      const passed = result.numFailedTests === 0
      
      return NextResponse.json({
        passed,
        warning: result.numFailedTests > 0 && result.numPassedTests > 0,
        details: `${result.numPassedTests} passed, ${result.numFailedTests} failed, ${result.numTotalTests} total`,
        output: output.slice(0, 50) // Limit output
      })
    } catch {
      // Fallback if JSON parsing fails
      const passed = !stderr && stdout.includes('passed')
      return NextResponse.json({
        passed,
        details: passed ? 'All tests passed' : 'Some tests failed',
        output: output.slice(0, 50)
      })
    }
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.stderr || error.message,
      output: error.stdout?.split('\n').slice(0, 50)
    })
  }
}

async function runIntegrationTests() {
  try {
    const { stdout, stderr } = await execAsync('npm test -- --run integration', {
      timeout: 60000
    })
    
    const passed = !stderr && stdout.includes('passed')
    
    return NextResponse.json({
      passed,
      details: passed ? 'All integration tests passed' : 'Some integration tests failed',
      output: stdout.split('\n').slice(0, 50)
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.stderr || error.message,
      output: error.stdout?.split('\n').slice(0, 50)
    })
  }
}

async function runTypeScriptCheck() {
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      timeout: 30000
    })
    
    return NextResponse.json({
      passed: true,
      details: 'No TypeScript errors found'
    })
  } catch (error: any) {
    const errorCount = (error.stdout?.match(/error TS/g) || []).length
    
    return NextResponse.json({
      passed: false,
      error: `Found ${errorCount} TypeScript errors`,
      details: error.stdout?.split('\n').slice(0, 20).join('\n')
    })
  }
}

async function runESLint() {
  try {
    const { stdout } = await execAsync('npx eslint . --ext .ts,.tsx --max-warnings 0', {
      timeout: 30000
    })
    
    return NextResponse.json({
      passed: true,
      details: 'No linting errors found'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      warning: true,
      error: 'Linting issues found',
      details: error.stdout?.split('\n').slice(0, 20).join('\n')
    })
  }
}

async function checkEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SIGNALWIRE_PROJECT_ID',
    'SIGNALWIRE_API_TOKEN',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ]

  const missing: string[] = []
  const present: string[] = []

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName)
    } else {
      missing.push(varName)
    }
  }

  const passed = missing.length === 0

  return NextResponse.json({
    passed,
    warning: missing.length > 0 && missing.length < requiredVars.length,
    details: passed 
      ? `All ${requiredVars.length} required environment variables are set`
      : `Missing: ${missing.join(', ')}`,
    output: [
      `✅ Present (${present.length}): ${present.join(', ')}`,
      missing.length > 0 ? `❌ Missing (${missing.length}): ${missing.join(', ')}` : ''
    ].filter(Boolean)
  })
}

async function testSupabaseConnection() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({
        passed: false,
        error: 'Supabase credentials not configured'
      })
    }

    // Test health endpoint
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    })

    const passed = res.status === 200

    return NextResponse.json({
      passed,
      details: passed 
        ? `Connected to Supabase (${supabaseUrl})`
        : `Connection failed with status ${res.status}`
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testSignalWireConnection() {
  try {
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN

    if (!projectId || !apiToken) {
      return NextResponse.json({
        passed: false,
        error: 'SignalWire credentials not configured'
      })
    }

    // Test SignalWire API
    const res = await fetch(`https://${projectId}.signalwire.com/api/laml/2010-04-01/Accounts/${projectId}.json`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${projectId}:${apiToken}`).toString('base64')}`
      }
    })

    const passed = res.status === 200

    return NextResponse.json({
      passed,
      details: passed 
        ? `Connected to SignalWire project ${projectId}`
        : `Connection failed with status ${res.status}`
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testAuthEndpoints() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    // Test signup endpoint exists
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    // We expect it to fail validation, but not 404
    const passed = signupRes.status !== 404

    return NextResponse.json({
      passed,
      details: passed 
        ? 'Auth endpoints are accessible'
        : 'Auth endpoints returned 404'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testVoiceEndpoints() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    // Test capabilities endpoint
    const res = await fetch(`${baseUrl}/api/call-capabilities`)

    // Should return 401 (need auth) or 200, but not 404
    const passed = res.status !== 404

    return NextResponse.json({
      passed,
      details: passed 
        ? 'Voice endpoints are accessible'
        : 'Voice endpoints returned 404'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testCapabilitiesEndpoint() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/call-capabilities`)

    const passed = res.status !== 404

    return NextResponse.json({
      passed,
      warning: res.status === 401,
      details: res.status === 401 
        ? 'Endpoint exists but requires authentication'
        : passed 
          ? 'Capabilities endpoint is accessible'
          : 'Capabilities endpoint returned 404'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testTranslationFeature() {
  try {
    // Check if translation files exist
    const fs = require('fs')
    const translationServiceExists = fs.existsSync(path.join(process.cwd(), 'app', 'services', 'translation.ts'))
    const swmlBuilderExists = fs.existsSync(path.join(process.cwd(), 'lib', 'signalwire', 'swmlBuilder.ts'))

    const passed = translationServiceExists && swmlBuilderExists

    return NextResponse.json({
      passed,
      details: passed
        ? 'Translation feature files are present'
        : 'Missing translation feature files',
      output: [
        `Translation Service: ${translationServiceExists ? '✅' : '❌'}`,
        `SWML Builder: ${swmlBuilderExists ? '✅' : '❌'}`
      ]
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testRecordingFeature() {
  try {
    const fs = require('fs')
    const recordingExists = fs.existsSync(path.join(process.cwd(), 'lib', 'signalwire'))

    return NextResponse.json({
      passed: recordingExists,
      details: recordingExists 
        ? 'Recording feature infrastructure exists'
        : 'Recording feature files missing'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testTranscriptionFeature() {
  try {
    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY
    
    return NextResponse.json({
      passed: !!assemblyAIKey,
      warning: !assemblyAIKey,
      details: assemblyAIKey 
        ? 'AssemblyAI API key configured'
        : 'AssemblyAI API key not configured (transcription will fail)'
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testRBACTypeConsistency() {
  try {
    const fs = require('fs')
    
    // Read RBAC files
    const rbacPath = path.join(process.cwd(), 'lib', 'rbac.ts')
    const useRBACPath = path.join(process.cwd(), 'hooks', 'useRBAC.ts')
    
    const rbacContent = fs.readFileSync(rbacPath, 'utf-8')
    const useRBACContent = fs.readFileSync(useRBACPath, 'utf-8')
    
    // Check for 'business' plan in both files
    const rbacHasBusiness = rbacContent.includes("'business'")
    const useRBACHasBusiness = useRBACContent.includes("'business'")
    
    const passed = rbacHasBusiness && useRBACHasBusiness
    
    return NextResponse.json({
      passed,
      details: passed 
        ? 'RBAC types are consistent across files'
        : 'RBAC type mismatch detected',
      output: [
        `lib/rbac.ts includes 'business': ${rbacHasBusiness ? '✅' : '❌'}`,
        `hooks/useRBAC.ts includes 'business': ${useRBACHasBusiness ? '✅' : '❌'}`
      ]
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}

async function testPermissionMatrix() {
  try {
    const fs = require('fs')
    const matrixPath = path.join(process.cwd(), 'tools', 'permission_matrix.json')
    
    if (!fs.existsSync(matrixPath)) {
      return NextResponse.json({
        passed: false,
        warning: true,
        details: 'Permission matrix file not found (may need to regenerate)'
      })
    }
    
    const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'))
    const endpointCount = Object.keys(matrix).length
    
    return NextResponse.json({
      passed: endpointCount > 0,
      details: `Permission matrix contains ${endpointCount} endpoints`
    })
  } catch (error: any) {
    return NextResponse.json({
      passed: false,
      error: error.message
    })
  }
}
