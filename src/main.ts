#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'
import { registerResources } from './resources.js'
import { registerPrompts } from './prompts.js'

// Create the MCP server
const server = new McpServer({
  name: 'sample-mcp',
  version: '1.0.0',
})

// Register all primitives
registerTools(server)
registerResources(server)
registerPrompts(server)

// Start the server with stdio transport
try {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Sample MCP server running on stdio')
} catch (error) {
  console.error('Fatal error:', error)
  process.exit(1)
}
