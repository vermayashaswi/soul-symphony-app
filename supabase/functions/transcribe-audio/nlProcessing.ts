
/**
 * Natural Language Processing utilities using Google NL API
 */

/**
 * Analyzes text using Google NL API for sentiment only
 */
export async function analyzeWithGoogleNL(text: string, googleNLApiKey: string) {
  try {
    console.log('Analyzing text with Google NL API for sentiment:', text.slice(0, 100) + '...');
    
    if (!googleNLApiKey) {
      console.error('Google NL API key missing from environment');
      return { sentiment: null };
    }
    
    // Improved API key validation - check for basic format but be less restrictive
    if (googleNLApiKey.length < 10) {
      console.error('Google NL API key appears to be too short:', googleNLApiKey.substring(0, 5) + '...');
      return { sentiment: null };
    }
    
    // Make the API call for sentiment analysis
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
        encodingType: 'UTF8'
      }),
    });

    if (!sentimentResponse.ok) {
      const error = await sentimentResponse.text();
      console.error('Error analyzing sentiment with Google NL API:', error);
      
      try {
        const errorJson = JSON.parse(error);
        console.error('Google NL API error details:', errorJson);
        
        if (errorJson.error && errorJson.error.status === 'INVALID_ARGUMENT') {
          console.error('Invalid argument error - check text format and encoding');
        } else if (errorJson.error && errorJson.error.status === 'PERMISSION_DENIED') {
          console.error('Permission denied - check API key and ensure it has Natural Language API permissions');
        } else if (errorJson.error && errorJson.error.status === 'UNAUTHENTICATED') {
          console.error('Unauthenticated - API key may be invalid or expired');
        }
      } catch (e) {
        console.error('Error parsing Google NL API error response:', e);
      }
      
      return { sentiment: null };
    }

    const sentimentResult = await sentimentResponse.json();
    
    console.log('Google NL API sentiment analysis complete:', sentimentResult.documentSentiment);
    
    // Get sentiment score from sentiment analysis response
    const sentimentScore = sentimentResult.documentSentiment?.score?.toString() || null;
    
    console.log(`Extracted sentiment score: ${sentimentScore}`);
    
    return { sentiment: sentimentScore };
  } catch (error) {
    console.error('Error in analyzeWithGoogleNL:', error);
    return { sentiment: null };
  }
}
