
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
      return { sentiment: "0" };
    }
    
    // Validate API key format to detect obvious errors
    if (googleNLApiKey.length < 20 || !googleNLApiKey.includes('-')) {
      console.error('Google NL API key appears to be invalid:', googleNLApiKey.substring(0, 5) + '...');
      return { sentiment: "0" };
    }
    
    // Limit text length to avoid API issues
    const maxTextLength = 100000;
    const processedText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
    
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
          content: processedText,
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
        }
      } catch (e) {
        console.error('Error parsing Google NL API error response:', e);
      }
      
      return { sentiment: "0" };
    }

    const sentimentResult = await sentimentResponse.json();
    
    console.log('Google NL API sentiment analysis complete:', sentimentResult.documentSentiment);
    
    // Get sentiment score from sentiment analysis response with robust validation
    let sentimentScore = "0";
    
    if (sentimentResult.documentSentiment && 
        typeof sentimentResult.documentSentiment.score !== 'undefined') {
      const score = sentimentResult.documentSentiment.score;
      
      // Validate numeric score
      if (typeof score === 'number' && !isNaN(score)) {
        sentimentScore = score.toString();
        console.log(`Extracted valid sentiment score: ${sentimentScore}`);
      } else {
        console.error(`Invalid sentiment score detected:`, score);
        sentimentScore = "0";
      }
    } else {
      console.error('Missing sentiment score in API response');
    }
    
    return { sentiment: sentimentScore };
  } catch (error) {
    console.error('Error in analyzeWithGoogleNL:', error);
    return { sentiment: "0" };
  }
}
