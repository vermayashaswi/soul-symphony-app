/**
 * Enhanced JSON extraction and parsing with multiple fallback strategies
 */
export function extractAndParseJSON(content: string): any {
  if (!content || content.trim().length === 0) {
    throw new Error('Empty content provided for JSON parsing');
  }
  
  // Enhanced JSON extraction with multiple fallback strategies
  let jsonContent = content.trim();
  
  // Strategy 1: Remove markdown code fences
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Strategy 2: Find JSON object boundaries
  const firstBrace = jsonContent.indexOf('{');
  const lastBrace = jsonContent.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
  }
  
  // Strategy 3: Clean up common JSON formatting issues
  jsonContent = jsonContent
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/'/g, '"') // Replace single quotes with double quotes
    .replace(/\\"/g, '\\"') // Fix escaped quotes
    .replace(/\n\s*\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
  
  // Strategy 4: Attempt parsing with error recovery
  try {
    const parsed = JSON.parse(jsonContent);
    console.log('[JSON Parser] Successfully parsed on first attempt');
    return parsed;
  } catch (error) {
    console.log('[JSON Parser] First attempt failed, trying recovery strategies');
    
    // Strategy 5: Try to fix common JSON issues
    let recoveredContent = jsonContent;
    
    // Fix unquoted property names
    recoveredContent = recoveredContent.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    
    // Fix unquoted string values (but not numbers, booleans, or null)
    recoveredContent = recoveredContent.replace(/:(\s*)([a-zA-Z_][a-zA-Z0-9_]*(?:\s+[a-zA-Z_][a-zA-Z0-9_]*)*)/g, (match, space, value) => {
      // Don't quote numbers, booleans, or null
      if (/^(true|false|null|\d+\.?\d*)$/.test(value.trim())) {
        return match;
      }
      return `:${space}"${value.trim()}"`;
    });
    
    // Strategy 6: Handle malformed arrays and objects
    recoveredContent = recoveredContent
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas again
      .replace(/([{,]\s*)"(\w+)"\s*:\s*"([^"]*)",?(\s*[}\]])/g, '$1"$2": "$3"$4'); // Fix spacing issues
    
    try {
      const recovered = JSON.parse(recoveredContent);
      console.log('[JSON Parser] Successfully parsed after recovery');
      return recovered;
    } catch (recoveryError) {
      // Strategy 7: Try to extract just the core JSON structure
      console.log('[JSON Parser] Attempting core structure extraction');
      
      const coreMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (coreMatch) {
        try {
          const coreJson = JSON.parse(coreMatch[0]);
          console.log('[JSON Parser] Successfully parsed core structure');
          return coreJson;
        } catch (coreError) {
          // Final fallback - log everything and throw
          console.error('[JSON Parser] All parsing strategies failed');
          console.log('[JSON Parser] Original content:', content);
          console.log('[JSON Parser] Cleaned content:', jsonContent);
          console.log('[JSON Parser] Recovery content:', recoveredContent);
          throw new Error(`Failed to parse JSON after all recovery attempts: ${error.message}`);
        }
      } else {
        throw new Error(`No valid JSON structure found in content: ${error.message}`);
      }
    }
  }
}