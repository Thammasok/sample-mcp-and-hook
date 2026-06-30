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

// Start the server with stdio transport
try {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Sample MCP server running on stdio')
} catch (error) {
  console.error('Fatal error:', error)
  process.exit(1)
}
