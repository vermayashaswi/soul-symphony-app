
/**
 * Natural Language Processing utilities using Google NL API
 */

/**
 * Maps Google entity types to our simplified schema
 */
export function mapEntityType(googleEntityType: string): string {
  switch (googleEntityType) {
    case 'PERSON':
      return 'person';
    case 'LOCATION':
    case 'ADDRESS':
      return 'place';
    case 'ORGANIZATION':
    case 'CONSUMER_GOOD':
    case 'WORK_OF_ART':
      return 'organization';
    case 'EVENT':
      return 'event';
    case 'OTHER':
    default:
      return 'other';
  }
}

/**
 * Removes duplicate entities from the extracted list
 */
export function removeDuplicateEntities(entities: Array<{type: string, name: string}>): Array<{type: string, name: string}> {
  const seen = new Set();
  return entities.filter(entity => {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Analyzes text using Google NL API for sentiment and entities
 */
export async function analyzeWithGoogleNL(text: string, googleNLApiKey: string) {
  try {
    console.log('Analyzing text with Google NL API for sentiment and entities:', text.slice(0, 100) + '...');
    
    if (!googleNLApiKey) {
      console.error('Google NL API key missing from environment');
      return { sentiment: "0", entities: [] };
    }
    
    // Validate API key format to detect obvious errors
    if (googleNLApiKey.length < 20 || !googleNLApiKey.includes('-')) {
      console.error('Google NL API key appears to be invalid:', googleNLApiKey.substring(0, 5) + '...');
      return { sentiment: "0", entities: [] };
    }
    
    // Make two separate API calls - one for sentiment analysis and one for entity extraction
    
    // 1. Sentiment Analysis
    console.log('Making sentiment analysis request to Google NL API...');
    const sentimentResponse = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleNLApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text,
        },
      }),
    });

    // 2. Entity Extraction
    console.log('Making entity extraction request to Google NL API...');
    const entityResponse = await fetch(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${googleNLApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text,
        },
      }),
    });

    if (!sentimentResponse.ok) {
      const error = await sentimentResponse.text();
      console.error('Error analyzing sentiment with Google NL API:', error);
      
      // Log more details about the error
      try {
        const errorJson = JSON.parse(error);
        console.error('Google NL API error details:', errorJson);
        
        // Check for common errors
        if (errorJson.error && errorJson.error.status === 'INVALID_ARGUMENT') {
          console.error('Invalid argument error - check text format and encoding');
        } else if (errorJson.error && errorJson.error.status === 'PERMISSION_DENIED') {
          console.error('Permission denied - check API key and ensure it has Natural Language API permissions');
        }
      } catch (e) {
        console.error('Error parsing Google NL API error response:', e);
      }
      
      return { sentiment: "0", entities: [] };
    }

    if (!entityResponse.ok) {
      const error = await entityResponse.text();
      console.error('Error analyzing entities with Google NL API:', error);
      return { sentiment: "0", entities: [] };
    }

    const sentimentResult = await sentimentResponse.json();
    const entityResult = await entityResponse.json();
    
    console.log('Google NL API sentiment analysis complete:', sentimentResult.documentSentiment);
    console.log('Google NL API entity analysis complete, found entities:', entityResult.entities?.length || 0);
    
    // Get sentiment score from sentiment analysis response
    const sentimentScore = sentimentResult.documentSentiment?.score?.toString() || "0";
    
    // Process and format entities from entity analysis response
    const formattedEntities = entityResult.entities?.map(entity => ({
      type: mapEntityType(entity.type),
      name: entity.name
    })) || [];
    
    // Remove duplicate entities
    const uniqueEntities = removeDuplicateEntities(formattedEntities);
    
    console.log(`Extracted ${uniqueEntities.length} entities and sentiment score: ${sentimentScore}`);
    
    return { 
      sentiment: sentimentScore, 
      entities: uniqueEntities
    };
  } catch (error) {
    console.error('Error in analyzeWithGoogleNL:', error);
    return { sentiment: "0", entities: [] };
  }
}
