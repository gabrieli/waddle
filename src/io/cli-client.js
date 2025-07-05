// cli-client.js
const [,, command, ...args] = process.argv;

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Help text
const HELP_TEXT = `
Usage: node cli-client.js <command> [args...]

Commands:
  status                          Get server status
  echo <message>                  Echo a message
  process <data>                  Process some data
  restart [service]               Restart a service (default: 'default')
  calculate <op> <a> <b>          Calculate (op: add|subtract|multiply|divide)
  list [type]                     List items (type: all|users|services|tasks)
  help                            Show this help message

Examples:
  node cli-client.js status
  node cli-client.js echo Hello World
  node cli-client.js calculate add 5 3
  node cli-client.js list users

Environment:
  SERVER_URL=${SERVER_URL}
`;

if (!command || command === 'help') {
  console.log(HELP_TEXT);
  process.exit(0);
}

async function sendCommand(cmd, data = {}) {
  try {
    const response = await fetch(`${SERVER_URL}/command/${cmd}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (result.success) {
      // Pretty print the result
      if (typeof result.result === 'object') {
        console.log(JSON.stringify(result.result, null, 2));
      } else {
        console.log(result.result);
      }
    } else {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to connect to server:', error.message);
    console.error(`   Make sure the server is running at ${SERVER_URL}`);
    process.exit(1);
  }
}

// Parse arguments based on command
const commandData = {};

switch (command) {
  case 'process':
    if (args.length > 0) {
      commandData.data = args.join(' ');
    }
    break;
  
  case 'restart':
    if (args.length > 0) {
      commandData.service = args[0];
    }
    break;
  
  case 'echo':
    if (args.length > 0) {
      commandData.message = args.join(' ');
    }
    break;
    
  case 'calculate':
    if (args.length < 3) {
      console.error('❌ Calculate requires: <operation> <a> <b>');
      console.error('   Example: node cli-client.js calculate add 5 3');
      process.exit(1);
    }
    commandData.operation = args[0];
    commandData.a = args[1];
    commandData.b = args[2];
    break;
    
  case 'list':
    if (args.length > 0) {
      commandData.type = args[0];
    }
    break;
}

sendCommand(command, commandData);