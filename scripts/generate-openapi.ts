/**
 * OpenAPI Generator Script
 *
 * Generates OpenAPI 3.0 specification from Zod schemas and route definitions.
 * Output: docs/openapi.yaml
 *
 * Usage: npm run docs:generate
 */

import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import {
  ValidateKeySchema,
  SignupSchema,
  LoginSchema,
  ForgotPasswordSchema,
  StartCallSchema,
  CallOutcomeSchema,
  CallOutcomeUpdateSchema,
  GenerateSummarySchema,
  CallNoteSchema,
  DispositionSchema,
  ConfirmationSchema,
  EmailCallSchema,
  VoiceConfigSchema,
  CreateCallSchema,
  VoiceTargetSchema,
  CreateTeamSchema,
  UpdateTeamSchema,
  AddTeamMemberSchema,
  SwitchOrgSchema,
  UpdateRoleSchema,
  InviteMemberSchema,
  AddMemberSchema,
  CreateBookingSchema,
  UpdateBookingSchema,
  CreateSurveySchema,
  UpdateRetentionSchema,
  CreateLegalHoldSchema,
  UpdateAIConfigSchema,
  CheckoutSchema,
  CreateOrgSchema,
  AddCallerIdSchema,
  VerifyCallerIdSchema,
  WebRTCDialSchema,
  CreateCampaignSchema,
  UpdateCampaignSchema,
  AnalyzeCallSchema,
  ChatSchema,
  UpdateInsightSchema,
  BulkInsightSchema,
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  CopilotSchema,
  GenerateReportSchema,
  ScheduleReportSchema,
  UpdateScheduleSchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
  CreateScorecardSchema,
  CreateShopperSchema,
  UpdateShopperSchema,
  DeleteShopperByIdSchema,
  UpdateAuthProviderSchema,
  WebhookActionSchema,
  TTSGenerateSchema,
  TranscribeSchema,
  LogComplianceViolationSchema,
  ResolveComplianceViolationSchema,
} from '../workers/src/lib/schemas'

// Extend Zod with OpenAPI
extendZodWithOpenApi(z)

// Create registry
const registry = new OpenAPIRegistry()

// ─── Common Response Schemas ───────────────────────────────────────────────

const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    error: z.string().describe('Error message'),
  })
)

const SuccessResponseSchema = registry.register(
  'SuccessResponse',
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
  })
)

// ─── Auth Endpoints ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/auth/session',
  description: 'Get current session information',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Session data',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string().uuid(),
              email: z.string().email(),
              name: z.string(),
              organization_id: z.string().uuid(),
              role: z.string(),
            }).nullable(),
            expires: z.string().nullable(),
          }),
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/validate-key',
  description: 'Validate API key for external integrations',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidateKeySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'API key is valid',
      content: {
        'application/json': {
          schema: z.object({
            valid: z.boolean(),
            organization_id: z.string().uuid(),
            organization_name: z.string(),
            permissions: z.array(z.string()),
          }),
        },
      },
    },
    401: {
      description: 'Invalid or expired API key',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/signup',
  description: 'Create a new user account',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SignupSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string().uuid(),
              email: z.string().email(),
            }),
            session: z.object({
              token: z.string(),
              expires: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'User already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  description: 'Login to existing account',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string().uuid(),
              email: z.string().email(),
            }),
            session: z.object({
              token: z.string(),
              expires: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/forgot-password',
  description: 'Request password reset',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password reset email sent',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
  },
})

// ─── Calls Endpoints ──────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/calls',
  description: 'List calls for organization',
  tags: ['Calls'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      status: z.enum(['all', 'active', 'completed', 'failed']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of calls',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            calls: z.array(z.any()),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/calls/start',
  description: 'Start a new call',
  tags: ['Calls'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: StartCallSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Call started successfully',
      content: {
        'application/json': {
          schema: z.object({
            call_id: z.string().uuid(),
            status: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/calls/{id}',
  description: 'Get call details',
  tags: ['Calls'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Call details',
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
    404: {
      description: 'Call not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/calls/{id}/outcome',
  description: 'Update call outcome',
  tags: ['Calls'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: CallOutcomeUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Outcome updated',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
  },
})

// ─── Billing Endpoints ────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/billing/checkout',
  description: 'Create Stripe checkout session',
  tags: ['Billing'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CheckoutSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Checkout session created',
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url(),
          }),
        },
      },
    },
  },
})

// ─── Organizations Endpoints ──────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/organizations',
  description: 'Create new organization',
  tags: ['Organizations'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOrgSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Organization created',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            name: z.string(),
          }),
        },
      },
    },
  },
})

// ─── WebRTC Endpoints ─────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/webrtc/dial',
  description: 'Initiate WebRTC call',
  tags: ['WebRTC'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: WebRTCDialSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Call initiated',
      content: {
        'application/json': {
          schema: z.object({
            call_id: z.string(),
            status: z.string(),
          }),
        },
      },
    },
  },
})

// ─── Health Endpoints ─────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/health',
  description: 'API health check',
  tags: ['Health'],
  responses: {
    200: {
      description: 'API is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
})

// ─── Generate OpenAPI Document ───────────────────────────────────────────

const generator = new OpenApiGeneratorV3(registry.definitions)

const openApiDocument = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Wordis Bond API',
    version: '4.11.0',
    description: 'The System of Record for Business Conversations - API Documentation',
    contact: {
      name: 'Wordis Bond Support',
      url: 'https://wordis-bond.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'https://wordisbond-api.adrper79.workers.dev',
      description: 'Production API',
    },
    {
      url: 'http://localhost:8787',
      description: 'Local Development',
    },
  ],
  security: [
    {
      BearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management',
    },
    {
      name: 'Calls',
      description: 'Call management and recording',
    },
    {
      name: 'Billing',
      description: 'Subscription and payment management',
    },
    {
      name: 'Organizations',
      description: 'Organization management',
    },
    {
      name: 'WebRTC',
      description: 'Real-time communication',
    },
    {
      name: 'Health',
      description: 'API health monitoring',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Session token obtained from login or signup',
      },
    },
  },
})

// ─── Write to File ────────────────────────────────────────────────────────

const docsDir = path.join(process.cwd(), 'docs')
const outputPath = path.join(docsDir, 'openapi.json')

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true })
}

// Write JSON file (easier to work with than YAML for now)
fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2))

console.log('✅ OpenAPI specification generated successfully!')
console.log(`📄 Output: ${outputPath}`)
console.log(`📊 Documented ${Object.keys(openApiDocument.paths || {}).length} endpoints`)
console.log(`🏷️  ${openApiDocument.tags?.length || 0} tags`)
console.log(`\n🔍 View at: https://editor.swagger.io/`)
console.log(`📋 Paste the contents of ${outputPath} into the editor`)
