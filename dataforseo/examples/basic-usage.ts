/**
 * Basic usage example for the DataForSEO MCP Server
 * 
 * This example shows how to:
 * 1. Start the MCP server
 * 2. Make a query to the server
 * 
 * Run this example with:
 * DATAFORSEO_LOGIN=your_login DATAFORSEO_PASSWORD=your_password ts-node examples/basic-usage.ts
 */

// Import required libraries
import { spawn } from 'child_process';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  // Start the server process
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  
  if (!login || !password) {
    console.error('Please set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables');
    process.exit(1);
  }
  
  // Start the server process
  const serverProcess = spawn(
    'node', 
    ['dist/index.js'], 
    {
      env: {
        ...process.env,
        DATAFORSEO_LOGIN: login,
        DATAFORSEO_PASSWORD: password
      },
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  
  // Connect to the server
  const transport = new StdioClientTransport(
    serverProcess.stdin,
    serverProcess.stdout
  );
  
  // Handle server errors
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });
  
  // Create the client
  const client = new McpClient();
  await client.connect(transport);
  
  // Log the server information
  console.log('Connected to server:', await client.getServerInfo());
  
  try {
    // Example 1: Get Google search results for "best seo tools"
    console.log('Example 1: Google Organic Search');
    const searchResult = await client.callTool('serp_google_organic_live', {
      keyword: 'best seo tools',
      location_code: 2840, // USA
      language_code: 'en'
    });
    console.log('Search result:', JSON.parse(searchResult.content[0].text));
    
    // Example 2: Get related keywords for "seo tools"
    console.log('\nExample 2: Related Keywords');
    const keywordsResult = await client.callTool('labs_google_related_keywords', {
      keyword: 'seo tools',
      location_code: 2840,
      language_code: 'en',
      limit: 5
    });
    console.log('Related keywords:', JSON.parse(keywordsResult.content[0].text));
    
    // Example 3: Check backlinks summary for a domain
    console.log('\nExample 3: Backlinks Summary');
    const backlinksResult = await client.callTool('backlinks_summary', {
      target: 'dataforseo.com',
      limit: 5
    });
    console.log('Backlinks summary:', JSON.parse(backlinksResult.content[0].text));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect and close the server
    await client.disconnect();
    serverProcess.kill();
  }
}

main().catch(console.error);