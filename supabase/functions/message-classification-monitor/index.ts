import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessageClassificationAnalysis {
  threadId: string;
  totalMessages: number;
  assistantMessages: number;
  userMessages: number;
  messagesByClassification: Record<string, number>;
  missingClassifications: number;
  persistenceIssues: string[];
  healthScore: number;
}

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

    const { action, threadId, timeRange } = await req.json();

    console.log(`[MessageClassificationMonitor] Action: ${action}, ThreadId: ${threadId}`);

    switch (action) {
      case 'analyze_thread':
        return await analyzeThreadClassifications(supabaseClient, threadId);
      
      case 'analyze_all_threads':
        return await analyzeAllThreadClassifications(supabaseClient, timeRange);
      
      case 'fix_missing_classifications':
        return await fixMissingClassifications(supabaseClient, threadId);
      
      case 'validate_persistence':
        return await validateMessagePersistence(supabaseClient, threadId);
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action. Available: analyze_thread, analyze_all_threads, fix_missing_classifications, validate_persistence'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('[MessageClassificationMonitor] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeThreadClassifications(
  supabaseClient: ReturnType<typeof createClient>, 
  threadId: string
): Promise<Response> {
  
  const { data: messages, error } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const analysis: MessageClassificationAnalysis = {
    threadId,
    totalMessages: messages.length,
    assistantMessages: messages.filter(m => m.sender === 'assistant').length,
    userMessages: messages.filter(m => m.sender === 'user').length,
    messagesByClassification: {},
    missingClassifications: 0,
    persistenceIssues: [],
    healthScore: 100
  };

  // Analyze classifications
  for (const message of messages) {
    if (message.sender === 'assistant') {
      const metadata = message.analysis_data;
      
      if (metadata && metadata.queryClassification) {
        const classification = metadata.queryClassification;
        analysis.messagesByClassification[classification] = 
          (analysis.messagesByClassification[classification] || 0) + 1;
      } else {
        analysis.missingClassifications++;
        analysis.persistenceIssues.push(
          `Message ${message.id} missing classification metadata`
        );
      }
      
      // Check for JSON artifacts in content
      if (message.content.includes('{"response"') || message.content.includes('"userStatusMessage"')) {
        analysis.persistenceIssues.push(
          `Message ${message.id} contains JSON artifacts in content`
        );
      }
    }
  }

  // Calculate health score
  if (analysis.assistantMessages > 0) {
    const classificationRate = (analysis.assistantMessages - analysis.missingClassifications) / analysis.assistantMessages;
    analysis.healthScore = Math.round(classificationRate * 100);
  }

  console.log(`[MessageClassificationMonitor] Thread analysis complete:`, analysis);

  return new Response(JSON.stringify({
    success: true,
    analysis,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function analyzeAllThreadClassifications(
  supabaseClient: ReturnType<typeof createClient>,
  timeRange?: { start: string; end: string }
): Promise<Response> {
  
  let query = supabaseClient
    .from('chat_messages')
    .select('thread_id, sender, analysis_data, content, created_at')
    .eq('sender', 'assistant');

  if (timeRange) {
    query = query
      .gte('created_at', timeRange.start)
      .lte('created_at', timeRange.end);
  }

  const { data: messages, error } = await query.limit(1000);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const threadAnalysis: Record<string, any> = {};
  const globalStats = {
    totalAssistantMessages: messages.length,
    messagesWithClassification: 0,
    classificationBreakdown: {} as Record<string, number>,
    threadsWithIssues: [] as string[]
  };

  for (const message of messages) {
    const threadId = message.thread_id;
    
    if (!threadAnalysis[threadId]) {
      threadAnalysis[threadId] = {
        messageCount: 0,
        classifiedCount: 0,
        classifications: {},
        issues: []
      };
    }

    threadAnalysis[threadId].messageCount++;

    const metadata = message.analysis_data;
    if (metadata && metadata.queryClassification) {
      threadAnalysis[threadId].classifiedCount++;
      globalStats.messagesWithClassification++;
      
      const classification = metadata.queryClassification;
      threadAnalysis[threadId].classifications[classification] = 
        (threadAnalysis[threadId].classifications[classification] || 0) + 1;
      globalStats.classificationBreakdown[classification] = 
        (globalStats.classificationBreakdown[classification] || 0) + 1;
    } else {
      threadAnalysis[threadId].issues.push(`Missing classification for message ${message.id}`);
    }

    // Check for content issues
    if (message.content.includes('{"response"') || message.content.includes('"userStatusMessage"')) {
      threadAnalysis[threadId].issues.push(`JSON artifacts in message ${message.id}`);
    }
  }

  // Identify threads with issues
  for (const [threadId, analysis] of Object.entries(threadAnalysis)) {
    if (analysis.issues.length > 0 || analysis.classifiedCount < analysis.messageCount) {
      globalStats.threadsWithIssues.push(threadId);
    }
  }

  console.log(`[MessageClassificationMonitor] Global analysis complete:`, globalStats);

  return new Response(JSON.stringify({
    success: true,
    globalStats,
    threadBreakdown: threadAnalysis,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fixMissingClassifications(
  supabaseClient: ReturnType<typeof createClient>,
  threadId?: string
): Promise<Response> {
  
  let query = supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('sender', 'assistant');

  if (threadId) {
    query = query.eq('thread_id', threadId);
  }

  const { data: messages, error } = await query.limit(100);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const fixedMessages = [];
  
  for (const message of messages) {
    const metadata = message.analysis_data || {};
    
    // If missing classification, try to infer from content or set default
    if (!metadata.queryClassification) {
      let inferredClassification = 'JOURNAL_SPECIFIC'; // Default
      
      // Try to infer from content patterns
      if (message.content.includes('I hear you') || message.content.includes('That sounds')) {
        inferredClassification = 'GENERAL_MENTAL_HEALTH';
      } else if (message.content.includes('clarify') || message.content.includes('help me understand')) {
        inferredClassification = 'GPT_CLARIFICATION';
      }
      
      // Update message with inferred classification
      const updatedMetadata = {
        ...metadata,
        queryClassification: inferredClassification,
        classificationInferred: true,
        classificationTimestamp: new Date().toISOString()
      };
      
      const { error: updateError } = await supabaseClient
        .from('chat_messages')
        .update({ analysis_data: updatedMetadata })
        .eq('id', message.id);
      
      if (!updateError) {
        fixedMessages.push({
          messageId: message.id,
          inferredClassification,
          threadId: message.thread_id
        });
      }
    }
  }

  console.log(`[MessageClassificationMonitor] Fixed ${fixedMessages.length} messages`);

  return new Response(JSON.stringify({
    success: true,
    fixedMessages,
    count: fixedMessages.length,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function validateMessagePersistence(
  supabaseClient: ReturnType<typeof createClient>,
  threadId: string
): Promise<Response> {
  
  // Check message health using existing function
  const { data: healthCheck, error: healthError } = await supabaseClient.rpc(
    'check_message_persistence_health',
    { thread_id_param: threadId }
  );

  if (healthError) {
    throw new Error(`Health check failed: ${healthError.message}`);
  }

  // Get detailed message breakdown
  const { data: messages, error: messagesError } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`);
  }

  const validation = {
    threadId,
    healthCheck,
    messageFlow: [],
    persistenceIssues: [],
    recommendations: []
  };

  // Analyze message flow
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const prevMessage = i > 0 ? messages[i - 1] : null;
    
    validation.messageFlow.push({
      index: i,
      messageId: message.id,
      sender: message.sender,
      hasContent: !!message.content,
      contentLength: message.content?.length || 0,
      hasMetadata: !!message.analysis_data,
      hasClassification: !!(message.analysis_data?.queryClassification),
      isProcessing: message.is_processing,
      created_at: message.created_at
    });

    // Check for flow issues
    if (prevMessage && prevMessage.sender === 'user' && message.sender !== 'assistant') {
      validation.persistenceIssues.push(
        `Expected assistant response after user message at index ${i - 1}`
      );
    }

    if (message.is_processing && new Date(message.created_at) < new Date(Date.now() - 5 * 60 * 1000)) {
      validation.persistenceIssues.push(
        `Message ${message.id} stuck in processing state for over 5 minutes`
      );
    }
  }

  // Generate recommendations
  if (healthCheck.health_score < 80) {
    validation.recommendations.push('Run cleanup_stuck_processing_messages function');
  }
  if (validation.persistenceIssues.length > 0) {
    validation.recommendations.push('Investigate message persistence pipeline');
  }

  console.log(`[MessageClassificationMonitor] Validation complete for thread ${threadId}`);

  return new Response(JSON.stringify({
    success: true,
    validation,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}