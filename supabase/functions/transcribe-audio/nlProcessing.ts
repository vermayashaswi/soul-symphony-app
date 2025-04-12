
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
    
    // Make two separate API calls - one for sentiment analysis and one for entity extraction
    
    // 1. Sentiment Analysis
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
      return { sentiment: "0", entities: [] };
    }

    if (!entityResponse.ok) {
      const error = await entityResponse.text();
      console.error('Error analyzing entities with Google NL API:', error);
      return { sentiment: "0", entities: [] };
    }

    const sentimentResult = await sentimentResponse.json();
    const entityResult = await entityResponse.json();
    
    console.log('Google NL API sentiment analysis complete');
    console.log('Google NL API entity analysis complete');
    
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
