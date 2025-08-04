// Enhanced debugging utilities for RAG search pipeline

export interface SearchDebugInfo {
  queryProcessing: {
    originalQuery: string;
    cleanedQuery: string;
    embeddingLength: number;
    hasValidEmbedding: boolean;
  };
  vectorSearch: {
    resultsCount: number;
    hasResults: boolean;
    similarityScores: number[];
    topResultScore: number | null;
  };
  sqlSearch: {
    resultsCount: number;
    hasResults: boolean;
    strategy: string;
  };
  combined: {
    totalResults: number;
    deduplicatedResults: number;
    finalStrategy: string;
  };
}

export class SearchDebugger {
  private static debugInfo: SearchDebugInfo = {
    queryProcessing: {
      originalQuery: '',
      cleanedQuery: '',
      embeddingLength: 0,
      hasValidEmbedding: false
    },
    vectorSearch: {
      resultsCount: 0,
      hasResults: false,
      similarityScores: [],
      topResultScore: null
    },
    sqlSearch: {
      resultsCount: 0,
      hasResults: false,
      strategy: ''
    },
    combined: {
      totalResults: 0,
      deduplicatedResults: 0,
      finalStrategy: ''
    }
  };

  static logQueryProcessing(originalQuery: string, cleanedQuery: string, embedding: number[]) {
    this.debugInfo.queryProcessing = {
      originalQuery,
      cleanedQuery,
      embeddingLength: embedding.length,
      hasValidEmbedding: embedding.length > 0 && embedding.every(n => !isNaN(n))
    };

    console.log('[SearchDebugger] Query Processing:', {
      originalQuery: originalQuery.substring(0, 100) + '...',
      cleanedQuery: cleanedQuery.substring(0, 100) + '...',
      embeddingLength: embedding.length,
      hasValidEmbedding: this.debugInfo.queryProcessing.hasValidEmbedding,
      embeddingSample: embedding.slice(0, 5)
    });
  }

  static logVectorSearchResults(results: any[]) {
    const scores = results
      .map(r => r.similarity || r.score)
      .filter(s => s !== undefined && !isNaN(s))
      .sort((a, b) => b - a);

    this.debugInfo.vectorSearch = {
      resultsCount: results.length,
      hasResults: results.length > 0,
      similarityScores: scores,
      topResultScore: scores.length > 0 ? scores[0] : null
    };

    console.log('[SearchDebugger] Vector Search Results:', {
      resultsCount: results.length,
      hasResults: results.length > 0,
      topResultScore: this.debugInfo.vectorSearch.topResultScore,
      scoreDistribution: {
        high: scores.filter(s => s >= 0.8).length,
        medium: scores.filter(s => s >= 0.5 && s < 0.8).length,
        low: scores.filter(s => s < 0.5).length
      },
      resultEntryDates: results.slice(0, 5).map(r => ({
        id: r.id,
        date: r.created_at || r.date,
        score: r.similarity || r.score
      }))
    });

    // Check for potential issues
    if (results.length === 0) {
      console.warn('[SearchDebugger] ⚠️ Vector search returned 0 results - potential issues:');
      console.warn('- Check if embedding generation is working correctly');
      console.warn('- Verify database has journal entries for this user');
      console.warn('- Check vector similarity threshold (currently 0.5)');
    }

    if (this.debugInfo.vectorSearch.topResultScore && this.debugInfo.vectorSearch.topResultScore < 0.3) {
      console.warn('[SearchDebugger] ⚠️ Low similarity scores detected - query may be too different from existing content');
    }
  }

  static logSQLSearchResults(results: any[], strategy: string) {
    this.debugInfo.sqlSearch = {
      resultsCount: results.length,
      hasResults: results.length > 0,
      strategy
    };

    console.log('[SearchDebugger] SQL Search Results:', {
      resultsCount: results.length,
      hasResults: results.length > 0,
      strategy,
      resultEntryDates: results.slice(0, 5).map(r => ({
        id: r.id,
        date: r.created_at || r.date
      }))
    });
  }

  static logCombinedResults(totalResults: number, deduplicatedResults: number, finalStrategy: string) {
    this.debugInfo.combined = {
      totalResults,
      deduplicatedResults,
      finalStrategy
    };

    console.log('[SearchDebugger] Combined Search Results:', {
      totalResults,
      deduplicatedResults,
      finalStrategy,
      deduplicationEffectiveness: totalResults > 0 ? ((totalResults - deduplicatedResults) / totalResults * 100).toFixed(1) + '%' : '0%'
    });

    // Generate diagnostic summary
    this.generateDiagnosticSummary();
  }

  static generateDiagnosticSummary() {
    const { queryProcessing, vectorSearch, sqlSearch, combined } = this.debugInfo;

    console.log('\n=== SEARCH PIPELINE DIAGNOSTIC SUMMARY ===');
    
    // Query processing health
    console.log('📝 Query Processing Health:', 
      queryProcessing.hasValidEmbedding ? '✅ Healthy' : '❌ Issues detected'
    );

    // Vector search health
    const vectorHealth = vectorSearch.hasResults && vectorSearch.topResultScore && vectorSearch.topResultScore > 0.3;
    console.log('🔍 Vector Search Health:', 
      vectorHealth ? '✅ Healthy' : '⚠️ Needs attention'
    );

    // SQL search health
    console.log('📊 SQL Search Health:', 
      sqlSearch.hasResults ? '✅ Healthy' : '⚠️ Limited results'
    );

    // Overall pipeline health
    const overallHealth = combined.deduplicatedResults > 0;
    console.log('🎯 Overall Pipeline Health:', 
      overallHealth ? '✅ Functional' : '❌ Critical issues'
    );

    // Recommendations
    if (!overallHealth) {
      console.log('\n🔧 RECOMMENDATIONS:');
      
      if (!queryProcessing.hasValidEmbedding) {
        console.log('- Fix embedding generation (check OpenAI API key and connectivity)');
      }
      
      if (!vectorSearch.hasResults) {
        console.log('- Check if user has journal entries with embeddings in database');
        console.log('- Verify vector similarity function is working correctly');
        console.log('- Consider lowering similarity threshold for testing');
      }
      
      if (!sqlSearch.hasResults) {
        console.log('- Check if user has journal entries in database');
        console.log('- Verify SQL search strategy is appropriate for query type');
      }
    }

    console.log('==========================================\n');
  }

  static getDebugInfo(): SearchDebugInfo {
    return { ...this.debugInfo };
  }

  static reset() {
    this.debugInfo = {
      queryProcessing: {
        originalQuery: '',
        cleanedQuery: '',
        embeddingLength: 0,
        hasValidEmbedding: false
      },
      vectorSearch: {
        resultsCount: 0,
        hasResults: false,
        similarityScores: [],
        topResultScore: null
      },
      sqlSearch: {
        resultsCount: 0,
        hasResults: false,
        strategy: ''
      },
      combined: {
        totalResults: 0,
        deduplicatedResults: 0,
        finalStrategy: ''
      }
    };
  }
}