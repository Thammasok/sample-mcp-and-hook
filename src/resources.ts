import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerResources(server: McpServer) {
  // Static resource - resource with fixed URI
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

  // Dynamic resource with template - resource with dynamic URI
  server.registerResource(
    'user-profile',
    'users://{userId}/profile',
    {
      description: 'User profile by ID',
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      const { userId } = extra as unknown as { userId: string }

      // Example: simulated user data
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
}
