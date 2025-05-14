
import React from 'react';
import { Card } from '@/components/ui/card';
import { TranslatableText } from "@/components/translation/TranslatableText";

interface AnalyticsDisplayProps {
  analysisData: any;
}

const AnalyticsDisplay: React.FC<AnalyticsDisplayProps> = ({ analysisData }) => {
  if (!analysisData) return null;
  
  return (
    <div className="mt-3 text-sm">
      <Card className="p-3 bg-muted/50">
        <h4 className="font-medium mb-2">
          <TranslatableText text="Analysis Results" forceTranslate={true} />
        </h4>
        
        {analysisData.type === 'quantitative_emotion' && (
          <div>
            <p>
              <TranslatableText 
                text={`Emotion strength: ${analysisData.score.toFixed(1)}/10`}
                forceTranslate={true} 
              />
            </p>
          </div>
        )}
        
        {analysisData.type === 'top_emotions' && (
          <div>
            <p>
              <TranslatableText 
                text="Top emotions detected:"
                forceTranslate={true} 
              />
            </p>
            <ul className="list-disc list-inside">
              {analysisData.emotions?.map((emotion: any, idx: number) => (
                <li key={idx}>
                  <TranslatableText 
                    text={`${emotion.name}: ${(emotion.score * 100).toFixed(0)}%`}
                    forceTranslate={true} 
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {analysisData.type === 'time_patterns' && (
          <div>
            <p>
              <TranslatableText 
                text="Time pattern analysis:"
                forceTranslate={true} 
              />
            </p>
            <p>
              <TranslatableText 
                text={analysisData.summary || "No clear patterns detected."}
                forceTranslate={true} 
              />
            </p>
          </div>
        )}
        
        {/* Add more analysis types as needed */}
      </Card>
    </div>
  );
};

export default AnalyticsDisplay;
