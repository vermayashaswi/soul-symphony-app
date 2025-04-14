
export async function translateAndRefineText(
  transcribedText: string, 
  openAIApiKey: string, 
  detectedLanguages: string[]
) {
  const languagesInfo = detectedLanguages.join(', ');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a multilingual journaling assistant. Your task is to translate and refine voice transcriptions from multiple languages into fluent, emotionally expressive English while keeping the original tone and meaning intact.

Follow these rules:
1. Translate complete thoughts or sentences to English. Avoid partial translations.
2. Use empathetic, human-like first-person phrasing. Avoid robotic tone.
3. Preserve cultural nuances (e.g., don't Anglicize idioms unless needed).
4. Avoid inserting new ideas. Only translate what was spoken.
5. Structure the final output as a personal journal entry.
6. Omit filler words ("uh", "umm") unless they affect tone or meaning.`
        },
        {
          role: 'user',
          content: `Here is the original transcription in multiple languages: ${transcribedText}
Detected languages: ${languagesInfo}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }),
  });

  const data = await response.json();
  const refinedText = data.choices[0].message.content.trim();

  return { refinedText };
}
