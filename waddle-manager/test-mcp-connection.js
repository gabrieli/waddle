#!/usr/bin/env node

async function testMCPConnection() {
  console.log('Testing MCP Server connection...\n');
  
  // Use dynamic import for node-fetch v3
  const fetch = (await import('node-fetch')).default;
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:5173/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData);
    
    // List available tools
    console.log('\n2. Listing available tools...');
    const toolsResponse = await fetch('http://localhost:5173/tools');
    const tools = await toolsResponse.json();
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    
    // Test getDevelopmentStatus via JSON-RPC
    console.log('\n3. Testing getDevelopmentStatus tool via JSON-RPC...');
    const rpcResponse = await fetch('http://localhost:5173/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getDevelopmentStatus',
        params: {},
        id: 1
      })
    });
    
    const rpcData = await rpcResponse.json();
    console.log('✅ getDevelopmentStatus response:', JSON.stringify(rpcData, null, 2));
    
    // Test WebSocket connection
    console.log('\n4. Testing WebSocket connection...');
    const io = (await import('socket.io-client')).default;
    const socket = io('http://localhost:5173');
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      
      // Test RPC over WebSocket
      socket.emit('rpc', {
        jsonrpc: '2.0',
        method: 'getDevelopmentStatus',
        params: {},
        id: 2
      }, (response) => {
        console.log('✅ WebSocket RPC response:', JSON.stringify(response, null, 2));
        socket.disconnect();
        process.exit(0);
      });
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testMCPConnection();