import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log("[system-health-checker] Starting comprehensive system health check");

    const healthResults = {
      timestamp: new Date().toISOString(),
      database: { status: 'unknown', details: {} },
      functions: { status: 'unknown', details: {} },
      dataIntegrity: { status: 'unknown', details: {} }
    };

    // Test 1: Database connectivity and execute_dynamic_query function
    try {
      const testQuery = 'SELECT COUNT(*) as total, MAX(created_at) as latest FROM "Journal Entries"';
      const { data: dbResult, error: dbError } = await supabaseClient.rpc('execute_dynamic_query', {
        query_text: testQuery
      });

      if (dbError) throw dbError;

      healthResults.database = {
        status: dbResult?.success ? 'healthy' : 'error',
        details: {
          executeFunction: dbResult?.success ? 'working' : 'failed',
          totalEntries: dbResult?.data?.[0]?.total || 0,
          latestEntry: dbResult?.data?.[0]?.latest || null,
          error: dbResult?.success === false ? dbResult?.error : null
        }
      };
    } catch (error) {
      healthResults.database = {
        status: 'error',
        details: { error: error.message }
      };
    }

    // Test 2: Core functions availability
    try {
      const functionsToTest = [
        'smart-query-planner',
        'gpt-response-consolidator',
        'chat-with-rag'
      ];

      const functionTests = {};
      
      for (const funcName of functionsToTest) {
        try {
          // Simple ping test with minimal payload
          const response = await supabaseClient.functions.invoke(funcName, {
            body: { healthCheck: true, message: 'ping' }
          });
          
          functionTests[funcName] = {
            status: response.error ? 'error' : 'accessible',
            error: response.error?.message || null
          };
        } catch (error) {
          functionTests[funcName] = {
            status: 'error',
            error: error.message
          };
        }
      }

      healthResults.functions = {
        status: Object.values(functionTests).some(f => f.status === 'error') ? 'partial' : 'healthy',
        details: functionTests
      };
    } catch (error) {
      healthResults.functions = {
        status: 'error',
        details: { error: error.message }
      };
    }

    // Test 3: Data integrity checks
    try {
      const integrityQueries = {
        entriesWithoutContent: 'SELECT COUNT(*) as count FROM "Journal Entries" WHERE ("refined text" IS NULL OR "refined text" = \'\') AND ("transcription text" IS NULL OR "transcription text" = \'\')',
        entriesWithoutEmbeddings: 'SELECT COUNT(*) as count FROM "Journal Entries" je LEFT JOIN journal_embeddings em ON je.id = em.journal_entry_id WHERE em.journal_entry_id IS NULL',
        recentEntries: 'SELECT COUNT(*) as count FROM "Journal Entries" WHERE created_at > NOW() - INTERVAL \'7 days\''
      };

      const integrityResults = {};
      
      for (const [key, query] of Object.entries(integrityQueries)) {
        try {
          const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
            query_text: query
          });
          
          if (error) throw error;
          
          integrityResults[key] = data?.success ? data.data[0]?.count : 'error';
        } catch (error) {
          integrityResults[key] = `error: ${error.message}`;
        }
      }

      healthResults.dataIntegrity = {
        status: Object.values(integrityResults).some(v => typeof v === 'string' && v.includes('error')) ? 'issues' : 'healthy',
        details: integrityResults
      };
    } catch (error) {
      healthResults.dataIntegrity = {
        status: 'error',
        details: { error: error.message }
      };
    }

    // Overall system status
    const overallStatus = 
      healthResults.database.status === 'error' ? 'critical' :
      (healthResults.functions.status === 'error' || healthResults.dataIntegrity.status === 'error') ? 'degraded' :
      (healthResults.functions.status === 'partial' || healthResults.dataIntegrity.status === 'issues') ? 'warning' :
      'healthy';

    console.log(`[system-health-checker] Health check complete. Overall status: ${overallStatus}`);

    return new Response(JSON.stringify({
      success: true,
      overallStatus,
      details: healthResults,
      recommendations: generateRecommendations(healthResults)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[system-health-checker] Error during health check:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      overallStatus: 'critical'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateRecommendations(healthResults) {
  const recommendations = [];
  
  if (healthResults.database.status === 'error') {
    recommendations.push('Database connectivity issues detected. Check database configuration and permissions.');
  }
  
  if (healthResults.functions.status === 'error' || healthResults.functions.status === 'partial') {
    recommendations.push('Some edge functions are not responding. Check function deployment and logs.');
  }
  
  if (healthResults.dataIntegrity.status === 'issues') {
    const details = healthResults.dataIntegrity.details;
    if (details.entriesWithoutEmbeddings > 0) {
      recommendations.push(`${details.entriesWithoutEmbeddings} journal entries missing embeddings. Consider running embedding generation.`);
    }
    if (details.entriesWithoutContent > 0) {
      recommendations.push(`${details.entriesWithoutContent} journal entries missing content. Review data import process.`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is healthy. All components functioning normally.');
  }
  
  return recommendations;
}