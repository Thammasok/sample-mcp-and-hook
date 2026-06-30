#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Create the MCP server
const server = new McpServer({
  name: 'sample-mcp',
  version: '1.0.0',
})

// Register a sample tool
server.registerTool(
  'greet',
  {
    description: 'Greets a user by name',
    inputSchema: {
      name: z.string().describe('The name of the person to greet'),
    },
  },
  async ({ name }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${name}! Welcome to the MCP server.`,
        },
      ],
    }
  },
)

// Register another sample tool
server.registerTool(
  'add',
  {
    description: 'Adds two numbers together',
    inputSchema: {
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    },
  },
  async ({ a, b }) => {
    const result = a + b
    return {
      content: [
        {
          type: 'text',
          text: `The sum of ${a} and ${b} is ${result}`,
        },
      ],
    }
  },
)

// ============================================
// Resources - ข้อมูลที่ AI สามารถอ่านได้
// ============================================

// Static resource - resource ที่มี URI คงที่
server.registerResource(
  'config',
  'config://app',
  {
    description: 'Application configuration',
    mimeType: 'application/json',
  },
  async () => {
    return {
      contents: [
        {
          uri: 'config://app',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              appName: 'Sample MCP',
              version: '1.0.0',
              features: ['tools', 'resources', 'prompts'],
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

// Dynamic resource with template - resource ที่มี URI แบบ dynamic
server.registerResource(
  'user-profile',
  'users://{userId}/profile',
  {
    description: 'User profile by ID',
    mimeType: 'application/json',
  },
  async (uri, extra) => {
    const { userId } = extra as unknown as { userId: string }

    // ตัวอย่าง: จำลองข้อมูล user
    const users: Record<string, { name: string; email: string }> = {
      '1': { name: 'Alice', email: 'alice@example.com' },
      '2': { name: 'Bob', email: 'bob@example.com' },
    }
    const user = users[userId] || { name: 'Unknown', email: 'unknown@example.com' }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(user, null, 2),
        },
      ],
    }
  },
)

// ============================================
// Prompts - Template prompts ที่เตรียมไว้ให้ใช้
// ============================================

// Simple prompt without arguments
server.registerPrompt(
  'explain-code',
  {
    description: 'Prompt for explaining code',
  },
  async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please explain the following code in detail, including its purpose, how it works, and any potential improvements.',
          },
        },
      ],
    }
  },
)

// Prompt with arguments
server.registerPrompt(
  'review-code',
  {
    description: 'Prompt for code review with specified focus',
    argsSchema: {
      language: z.string().describe('Programming language of the code'),
      focus: z.string().optional().describe('Focus area: security, performance, readability'),
    },
  },
  async ({ language, focus }) => {
    const focusArea = focus || 'general best practices'
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review the following ${language} code with a focus on ${focusArea}. Provide specific suggestions for improvement.`,
          },
        },
      ],
    }
  },
)

// Start the server with stdio transport
try {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Sample MCP server running on stdio')
} catch (error) {
  console.error('Fatal error:', error)
  process.exit(1)
}
