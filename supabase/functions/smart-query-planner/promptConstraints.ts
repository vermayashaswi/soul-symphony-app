// Enhanced prompt constraints for better SQL generation and error prevention

export function getEnhancedSQLConstraints(userTimezone: string): string {
  return `
**CRITICAL SQL GENERATION CONSTRAINTS:**

1. **POSTGRESQL COMPATIBILITY ONLY:**
   - Generate ONLY valid PostgreSQL syntax
   - Use proper PostgreSQL functions and data types
   - Test all expressions for PostgreSQL compatibility

2. **FORBIDDEN SQL PATTERNS (WILL CAUSE ERRORS):**
   ❌ NEVER USE: "'7 days ago (Asia/Kolkata)'" 
   ❌ NEVER USE: "'last week in Asia/Kolkata timezone'"
   ❌ NEVER USE: "(NOW() AT TIME ZONE 'timezone' - INTERVAL 'X days')"
   ❌ NEVER USE: Complex nested AT TIME ZONE expressions
   ❌ NEVER USE: Non-standard timestamp formats

3. **SAFE SQL PATTERNS (ALWAYS USE):**
   ✅ USE: "NOW() - INTERVAL '7 days'"
   ✅ USE: "NOW() - INTERVAL '1 week'" 
   ✅ USE: "NOW() - INTERVAL '30 days'"
   ✅ USE: "created_at >= '2025-08-20T00:00:00Z'"
   ✅ USE: Simple date comparisons

4. **MANDATORY QUERY STRUCTURE:**
   - Start with SELECT
   - Include user_id = auth.uid() in WHERE clause
   - Use "Journal Entries" (with quotes) for table name
   - End without semicolon
   - Keep queries simple and focused

5. **TIMEZONE HANDLING:**
   - User timezone: ${userTimezone}
   - Let the backend handle timezone conversion
   - Use only simple date arithmetic in SQL
   - Complex timezone logic will be handled by date processing functions

6. **ERROR PREVENTION:**
   - Always validate SQL syntax mentally before generation
   - Prefer simple queries over complex ones
   - When in doubt, use basic filtering
   - Test all time expressions for PostgreSQL validity

EXAMPLE SAFE QUERIES:
- Recent entries: WHERE created_at >= NOW() - INTERVAL '7 days'
- Count by theme: SELECT unnest(master_themes) as theme, COUNT(*) FROM "Journal Entries" WHERE user_id = auth.uid() GROUP BY theme
- Emotion analysis: SELECT emotions->>'emotion_name' as score FROM "Journal Entries" WHERE user_id = auth.uid()
`;
}

export function validatePromptGeneration(sqlQuery: string): { isValid: boolean; error?: string } {
  const forbiddenPatterns = [
    /'[^']*days ago[^']*'/i,
    /'[^']*week.*timezone[^']*'/i,
    /\(NOW\(\).*AT\s+TIME\s+ZONE.*INTERVAL/i,
    /AT\s+TIME\s+ZONE.*AT\s+TIME\s+ZONE/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sqlQuery)) {
      return { 
        isValid: false, 
        error: `Contains forbidden pattern: ${pattern.source}` 
      };
    }
  }

  return { isValid: true };
}