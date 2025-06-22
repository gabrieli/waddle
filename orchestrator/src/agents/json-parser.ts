export interface JsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawOutput: string;
}

export function parseAgentJsonResponse<T>(output: string, agentType: string): JsonParseResult<T> {
  console.log(`📝 Raw ${agentType} output length:`, output.length);
  if (process.env.DEBUG === 'true' || output.length < 500) {
    console.log(`📝 Raw ${agentType} output:`, output);
  }
  
  // First check if the output contains an error message
  if (output.toLowerCase().includes('error:') || 
      output.toLowerCase().includes('execution error') ||
      output.trim().startsWith('E')) {
    return {
      success: false,
      error: `Claude returned an error response: ${output.substring(0, 200)}`,
      rawOutput: output
    };
  }
  
  // Try multiple strategies to extract JSON
  let jsonStr: string | null = null;
  
  // Strategy 1: Look for JSON between specific markers (if Claude uses them)
  const jsonBlockMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1];
    console.log(`   ✅ Found JSON in code block for ${agentType}`);
  }
  
  // Strategy 2: Find the first complete JSON object
  if (!jsonStr) {
    // More robust regex that ensures we get a complete JSON object
    const jsonMatch = output.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
      console.log(`   ✅ Found JSON object using pattern matching for ${agentType}`);
    }
  }
  
  // Strategy 3: Try to find JSON starting from the first '{'
  if (!jsonStr) {
    const startIdx = output.indexOf('{');
    if (startIdx !== -1) {
      // Try to parse from each '{' to find valid JSON
      for (let i = startIdx; i < output.length; i++) {
        if (output[i] === '{') {
          let depth = 0;
          let endIdx = i;
          for (let j = i; j < output.length; j++) {
            if (output[j] === '{') depth++;
            if (output[j] === '}') depth--;
            if (depth === 0) {
              endIdx = j;
              break;
            }
          }
          if (depth === 0) {
            const candidate = output.substring(i, endIdx + 1);
            try {
              JSON.parse(candidate); // Test if valid JSON
              jsonStr = candidate;
              console.log(`   ✅ Found JSON by bracket matching for ${agentType}`);
              break;
            } catch {
              // Continue searching
            }
          }
        }
      }
    }
  }
  
  if (!jsonStr) {
    return {
      success: false,
      error: 'No valid JSON found in response',
      rawOutput: output
    };
  }
  
  // Clean the JSON string (remove any potential BOM or zero-width characters)
  jsonStr = jsonStr.trim()
    .replace(/^\uFEFF/, '') // Remove BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
  
  try {
    console.log(`   🔍 Attempting to parse JSON for ${agentType}...`);
    const data = JSON.parse(jsonStr) as T;
    console.log(`   ✅ Successfully parsed ${agentType} response`);
    
    return {
      success: true,
      data,
      rawOutput: output
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      rawOutput: output
    };
  }
}