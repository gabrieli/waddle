#!/usr/bin/env node

import net from 'net';
import readline from 'readline';

const DEFAULT_PORT = 8765;
const DEFAULT_HOST = 'localhost';

const port = parseInt(process.env.WADDLE_PORT || DEFAULT_PORT.toString(), 10);
const host = process.env.WADDLE_HOST || DEFAULT_HOST;

const client = new net.Socket();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'waddle> '
});

console.log(`Connecting to Waddle server at ${host}:${port}...`);

client.connect(port, host, () => {
  console.log('Connected to Waddle server');
  console.log('Type "help" for available commands or "exit" to quit\n');
  rl.prompt();
});

client.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    if (response.success) {
      console.log('Success:', JSON.stringify(response.result, null, 2));
    } else {
      console.error('Error:', response.error);
    }
  } catch (e) {
    console.log('Response:', data.toString());
  }
  rl.prompt();
});

client.on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('\nDisconnected from server');
  process.exit(0);
});

rl.on('line', (line) => {
  const command = line.trim();
  
  if (command === 'exit' || command === 'quit') {
    rl.close();
    client.end();
    return;
  }
  
  if (command === 'help') {
    console.log(`
Available commands:
  ping                          - Test server connection
  status                        - Get system status
  developer:assign <work_id>    - Assign developer to work item
  developer:status              - Get developer agents status
  developer:complete            - Information about work completion
  exit/quit                     - Exit the client
`);
    rl.prompt();
    return;
  }
  
  if (command) {
    client.write(command + '\n');
  } else {
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('\nGoodbye!');
  client.end();
});