import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerPrompts(server: McpServer) {
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
}
