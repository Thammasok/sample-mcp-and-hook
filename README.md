# Sample MCP Server

A sample MCP (Model Context Protocol) server built with Node.js and TypeScript, demonstrating the three core primitives: **Tools**, **Resources**, and **Prompts**.

## What is MCP?

**Model Context Protocol (MCP)** is an open protocol that standardizes how applications provide context to Large Language Models (LLMs). Think of it as a "USB-C port for AI" - a universal connector that allows AI assistants to interact with various data sources and tools in a consistent way.

MCP enables:

- AI models to access external data and services
- Developers to build integrations that work across multiple AI platforms
- Secure, controlled interactions between AI and external systems

## MCP Core Primitives

MCP defines three fundamental primitives:

### 1. Tools

**Tools** are functions that the AI can execute to perform actions or computations. They allow the model to interact with external systems, run calculations, or trigger workflows.

**Characteristics:**

- Invoked by the AI model
- Can have input parameters with validation
- Return results back to the model
- Used for actions like: API calls, calculations, file operations, database queries

**Example from this project:**

```typescript
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
      content: [{ type: 'text', text: `Hello, ${name}! Welcome to the MCP server.` }],
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
    return {
      content: [{ type: 'text', text: `The sum of ${a} and ${b} is ${a + b}` }],
    }
  },
)
```

### 2. Resources

**Resources** represent data that the AI can read and use as context. They provide a way to expose information from various sources (files, databases, APIs) to the model.

**Characteristics:**

- Read-only data access
- Can be static (fixed URI) or dynamic (URI templates)
- Support various MIME types (JSON, text, images, etc.)
- Used for: configuration data, user profiles, documents, database records

**Example from this project:**

```typescript
// Static Resource: Application configuration
server.registerResource(
  'config',
  'config://app',
  {
    description: 'Application configuration',
    mimeType: 'application/json',
  },
  async () => {
    return {
      contents: [{
        uri: 'config://app',
        mimeType: 'application/json',
        text: JSON.stringify({
          appName: 'Sample MCP',
          version: '1.0.0',
          features: ['tools', 'resources', 'prompts'],
        }, null, 2),
      }],
    }
  },
)

// Dynamic Resource: User profile with URI template
server.registerResource(
  'user-profile',
  'users://{userId}/profile',
  {
    description: 'User profile by ID',
    mimeType: 'application/json',
  },
  async (uri, extra) => {
    const { userId } = extra as unknown as { userId: string }
    // Fetch user data based on userId...
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(userData, null, 2),
      }],
    }
  },
)
```

### 3. Prompts

**Prompts** are reusable prompt templates that help standardize interactions with the AI. They can include predefined instructions, context, and optional arguments for customization.

**Characteristics:**

- Pre-defined message templates
- Can accept arguments for customization
- Help ensure consistent AI interactions
- Used for: code review templates, analysis prompts, standardized queries

**Example from this project:**

```typescript
// Simple Prompt: No arguments required
server.registerPrompt(
  'explain-code',
  {
    description: 'Prompt for explaining code',
  },
  async () => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'Please explain the following code in detail, including its purpose, how it works, and any potential improvements.',
        },
      }],
    }
  },
)

// Parameterized Prompt: Accepts arguments for customization
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
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please review the following ${language} code with a focus on ${focusArea}. Provide specific suggestions for improvement.`,
        },
      }],
    }
  },
)
```

## Comparison Table

| Primitive | Purpose | Direction | Use Case |
|-----------|---------|-----------|----------|
| **Tools** | Execute actions | AI → Server | Calculations, API calls, data mutations |
| **Resources** | Provide data | Server → AI | Configuration, documents, user data |
| **Prompts** | Template messages | Server → AI | Standardized instructions, reusable queries |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/sample-mcp.git
cd sample-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Running the Server

```bash
# Start the MCP server
npm start

# Or run in development mode with auto-rebuild
npm run dev
```

### Integration with AI Clients

To use this MCP server with an AI client (like Claude Desktop), add it to your MCP configuration:

```json
{
  "mcpServers": {
    "sample-mcp": {
      "command": "node",
      "args": ["/path/to/sample-mcp/dist/index.js"]
    }
  }
}
```

## Project Structure

```text
sample-mcp/
├── src/
│   └── index.ts      # Main MCP server implementation
├── dist/             # Compiled JavaScript output
├── package.json      # Project dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Dependencies

- **@modelcontextprotocol/sdk**: Official MCP SDK for building servers
- **zod**: TypeScript-first schema validation for input validation

## Learn More

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK GitHub](https://github.com/modelcontextprotocol/sdk)

## License

ISC
