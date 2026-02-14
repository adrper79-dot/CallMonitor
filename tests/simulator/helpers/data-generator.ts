/**
 * Test Data Generator — Workplace Person Simulator
 * Generates realistic test data for comprehensive E2E testing
 */

import { faker } from '@faker-js/faker'
import { TEST_DATA_TEMPLATES } from '../config'

export interface GeneratedUser {
  id: string
  email: string
  password: string
  first_name: string
  last_name: string
  full_name: string
  company_name: string
  phone_number: string
  industry: string
  team_size: string
  created_at: string
}

export interface GeneratedAccount {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip_code: string
  balance: number
  account_type: string
  status: string
  last_contact: string
  notes: string
}

export interface GeneratedCallScenario {
  id: string
  target_number: string
  purpose: string
  expected_duration_sec: number
  script: string[]
  expected_outcomes: string[]
  difficulty_level: 'easy' | 'medium' | 'hard'
}

export class TestDataGenerator {
  /**
   * Generate a complete test user with all required fields
   */
  static generateUser(): GeneratedUser {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const companyName = faker.company.name()

    return {
      id: faker.string.uuid(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: faker.internet.password({ length: 12, memorable: true }),
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      company_name: companyName,
      phone_number: faker.phone.number('+1##########'),
      industry: faker.helpers.arrayElement(TEST_DATA_TEMPLATES.INDUSTRIES),
      team_size: faker.helpers.arrayElement(TEST_DATA_TEMPLATES.TEAM_SIZES),
      created_at: new Date().toISOString()
    }
  }

  /**
   * Generate multiple test users
   */
  static generateUsers(count: number): GeneratedUser[] {
    return Array.from({ length: count }, () => this.generateUser())
  }

  /**
   * Generate a realistic customer account for testing
   */
  static generateAccount(): GeneratedAccount {
    const balance = faker.finance.amount({ min: 0, max: 5000, dec: 2 })
    const accountType = faker.helpers.arrayElement(TEST_DATA_TEMPLATES.ACCOUNT_TYPES)

    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      phone: faker.phone.number('+1##########'),
      email: faker.internet.email(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.stateAbbr(),
      zip_code: faker.location.zipCode(),
      balance: parseFloat(balance),
      account_type: accountType,
      status: faker.helpers.arrayElement(['active', 'past_due', 'paid', 'disputed']),
      last_contact: faker.date.recent({ days: 30 }).toISOString(),
      notes: faker.lorem.sentence()
    }
  }

  /**
   * Generate multiple accounts
   */
  static generateAccounts(count: number): GeneratedAccount[] {
    return Array.from({ length: count }, () => this.generateAccount())
  }

  /**
   * Generate a realistic call scenario
   */
  static generateCallScenario(): GeneratedCallScenario {
    const purpose = faker.helpers.arrayElement(TEST_DATA_TEMPLATES.CALL_PURPOSES)
    const difficulty = faker.helpers.arrayElement(['easy', 'medium', 'hard'] as const)

    const scripts = {
      easy: [
        'Hello, this is [Your Name] calling from [Company]',
        'I\'m calling about your account ending in ****',
        'Can you confirm this is [Customer Name]?',
        'Thank you for your time. Have a great day!'
      ],
      medium: [
        'Hello, this is [Your Name] from [Company] collections',
        'I\'m calling regarding the outstanding balance of $[Amount]',
        'We\'d like to discuss payment arrangements',
        'What would be a convenient time for you?',
        'Thank you for working with us on this'
      ],
      hard: [
        'Hello, this is [Your Name] with [Company]',
        'I understand you may have received previous calls',
        'We\'re here to help resolve this matter',
        'Can we discuss your current situation?',
        'I appreciate your understanding and cooperation'
      ]
    }

    const outcomes = {
      easy: ['Verification successful', 'Information confirmed'],
      medium: ['Payment arrangement made', 'Follow-up scheduled'],
      hard: ['Dispute resolved', 'Legal consultation recommended']
    }

    return {
      id: faker.string.uuid(),
      target_number: faker.phone.number('+1##########'),
      purpose,
      expected_duration_sec: faker.number.int({ min: 30, max: 300 }),
      script: scripts[difficulty],
      expected_outcomes: outcomes[difficulty],
      difficulty_level: difficulty
    }
  }

  /**
   * Generate multiple call scenarios
   */
  static generateCallScenarios(count: number): GeneratedCallScenario[] {
    return Array.from({ length: count }, () => this.generateCallScenario())
  }

  /**
   * Generate CSV data for bulk import testing
   */
  static generateAccountCSV(count: number): string {
    const accounts = this.generateAccounts(count)
    const headers = ['name', 'phone', 'email', 'address', 'city', 'state', 'zip_code', 'balance', 'account_type']

    const csvRows = [
      headers.join(','),
      ...accounts.map(account => [
        `"${account.name}"`,
        account.phone,
        account.email,
        `"${account.address}"`,
        `"${account.city}"`,
        account.state,
        account.zip_code,
        account.balance,
        account.account_type
      ].join(','))
    ]

    return csvRows.join('\n')
  }

  /**
   * Generate realistic conversation transcripts for testing
   */
  static generateTranscript(): {
    speaker: 'agent' | 'customer'
    text: string
    timestamp: string
  }[] {
    const conversationLength = faker.number.int({ min: 5, max: 15 })

    const agentLines = [
      'Hello, this is calling from collections.',
      'I\'m calling about your account balance.',
      'Can you confirm your identity?',
      'We\'d like to discuss payment options.',
      'What would work best for your situation?',
      'Thank you for your time.',
      'I appreciate your cooperation.'
    ]

    const customerLines = [
      'Hello, who is this?',
      'Yes, this is correct.',
      'I understand the situation.',
      'I can make a payment today.',
      'Can we set up a payment plan?',
      'I\'ll call you back later.',
      'Thank you for calling.'
    ]

    const transcript = []
    let currentSpeaker: 'agent' | 'customer' = 'agent'

    for (let i = 0; i < conversationLength; i++) {
      const lines = currentSpeaker === 'agent' ? agentLines : customerLines
      const text = faker.helpers.arrayElement(lines)

      transcript.push({
        speaker: currentSpeaker,
        text,
        timestamp: new Date(Date.now() + i * 2000).toISOString()
      })

      currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent'
    }

    return transcript
  }

  /**
   * Generate test data for analytics testing
   */
  static generateAnalyticsData(days: number = 30): {
    date: string
    calls_made: number
    successful_calls: number
    average_duration: number
    total_talk_time: number
  }[] {
    const data = []

    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      data.push({
        date: date.toISOString().split('T')[0],
        calls_made: faker.number.int({ min: 10, max: 50 }),
        successful_calls: faker.number.int({ min: 5, max: 40 }),
        average_duration: faker.number.int({ min: 60, max: 600 }),
        total_talk_time: faker.number.int({ min: 600, max: 18000 })
      })
    }

    return data
  }
}