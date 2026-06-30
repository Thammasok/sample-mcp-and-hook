import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerTools(server: McpServer) {
  // Tool: greet - Greets a user by name
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

  // Tool: add - Adds two numbers together
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
}
