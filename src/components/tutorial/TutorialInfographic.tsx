
import React from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Book, ChartLine, Calendar, GridIcon } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

// Define the different infographic types
export type InfographicType = 'insights-overview' | 'emotion-trends' | 'mood-calendar';

interface TutorialInfographicProps {
  type: InfographicType;
  className?: string;
}

const TutorialInfographic: React.FC<TutorialInfographicProps> = ({ type, className = '' }) => {
  // Shared styles for all infographics
  const containerStyles = "w-full rounded-md overflow-hidden border border-white/30 bg-[#1A1F2C]/80";
  const iconSize = 24;
  
  // Common colors from the app's palette
  const colors = {
    primary: "#9b87f5",
    secondary: "#7E69AB",
    tertiary: "#6E59A5",
    dark: "#1A1F2C",
    light: "#D6BCFA",
    soft: "#E5DEFF",
    brightBlue: "#1EAEDB",
    skyBlue: "#33C3F0",
    coolGray: "#aaadb0"
  };
  
  // Render different infographics based on type
  const renderInfographic = () => {
    switch(type) {
      case 'insights-overview':
        return (
          <div className="p-4 flex flex-col items-center">
            <div className="mb-3 flex items-center justify-center w-full">
              <h3 className="text-white text-lg font-semibold">
                <TranslatableText text="Emotional Insights" forceTranslate={true} />
              </h3>
              <Book className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">
                  <TranslatableText text="Top Emotion" forceTranslate={true} />
                </div>
                <div className="text-white font-medium">
                  <TranslatableText text="Happiness" forceTranslate={true} />
                </div>
                <div className="w-full h-2 bg-[#1A1F2C] rounded-full mt-2">
                  <div className="h-full rounded-full" style={{ width: '70%', backgroundColor: colors.primary }}></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">
                  <TranslatableText text="This Week" forceTranslate={true} />
                </div>
                <div className="text-white font-medium">
                  <TranslatableText text="Positive Trend" forceTranslate={true} />
                </div>
                <div className="w-full h-2 bg-[#1A1F2C] rounded-full mt-2">
                  <div className="h-full rounded-full" style={{ width: '85%', backgroundColor: colors.brightBlue }}></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">
                  <TranslatableText text="Entries" forceTranslate={true} />
                </div>
                <div className="text-white font-medium">
                  <TranslatableText text="24 Total" forceTranslate={true} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">
                  <TranslatableText text="Time Range" forceTranslate={true} />
                </div>
                <div className="text-white font-medium">
                  <TranslatableText text="Last 30 Days" forceTranslate={true} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="w-full h-1 bg-[#1A1F2C] rounded-full">
                    <div className="h-full rounded-full" style={{ width: '30%', backgroundColor: colors.skyBlue }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'emotion-trends':
        return (
          <div className="p-4 flex flex-col items-center">
            <div className="mb-3 flex items-center justify-center w-full">
              <h3 className="text-white text-lg font-semibold">
                <TranslatableText text="Emotion Trends" forceTranslate={true} />
              </h3>
              <ChartLine className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="w-full h-[140px] relative px-2">
              {/* Chart background */}
              <div className="absolute inset-x-0 bottom-0 h-[120px] border-b border-l border-[#aaadb0]/30">
                {/* Horizontal grid lines */}
                <div className="absolute w-full border-t border-[#aaadb0]/20 h-0" style={{ top: '25%' }}></div>
                <div className="absolute w-full border-t border-[#aaadb0]/20 h-0" style={{ top: '50%' }}></div>
                <div className="absolute w-full border-t border-[#aaadb0]/20 h-0" style={{ top: '75%' }}></div>
                
                {/* Month markers */}
                <div className="absolute bottom-[-20px] left-[25%] text-[10px] text-[#aaadb0]">
                  <TranslatableText text="Week 1" forceTranslate={true} />
                </div>
                <div className="absolute bottom-[-20px] left-[50%] text-[10px] text-[#aaadb0]">
                  <TranslatableText text="Week 2" forceTranslate={true} />
                </div>
                <div className="absolute bottom-[-20px] left-[75%] text-[10px] text-[#aaadb0]">
                  <TranslatableText text="Week 3" forceTranslate={true} />
                </div>
                
                {/* Emotion lines */}
                {/* Joy line */}
                <svg className="absolute inset-0 h-full w-full">
                  <path 
                    d={`M10,80 Q50,35 100,70 T200,50 T300,20`} 
                    fill="none" 
                    stroke={colors.primary} 
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="80" r="4" fill={colors.primary} />
                  <circle cx="100" cy="70" r="4" fill={colors.primary} />
                  <circle cx="200" cy="50" r="4" fill={colors.primary} />
                  <circle cx="300" cy="20" r="4" fill={colors.primary} />
                </svg>
                
                {/* Calm line */}
                <svg className="absolute inset-0 h-full w-full">
                  <path 
                    d={`M10,90 Q50,70 100,85 T200,75 T300,60`} 
                    fill="none" 
                    stroke={colors.skyBlue} 
                    strokeWidth="3" 
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="90" r="4" fill={colors.skyBlue} />
                  <circle cx="100" cy="85" r="4" fill={colors.skyBlue} />
                  <circle cx="200" cy="75" r="4" fill={colors.skyBlue} />
                  <circle cx="300" cy="60" r="4" fill={colors.skyBlue} />
                </svg>
              </div>
              
              {/* Legend */}
              <div className="absolute top-[-5px] right-2 flex items-center">
                <div className="h-3 w-3 rounded-full bg-[#9b87f5] mr-1"></div>
                <span className="text-[10px] text-white mr-3">
                  <TranslatableText text="Joy" forceTranslate={true} />
                </span>
                <div className="h-3 w-3 rounded-full bg-[#33C3F0] mr-1"></div>
                <span className="text-[10px] text-white">
                  <TranslatableText text="Calm" forceTranslate={true} />
                </span>
              </div>
            </div>
          </div>
        );
      
      case 'mood-calendar':
        return (
          <div className="p-4 flex flex-col items-center">
            <div className="mb-3 flex items-center justify-center w-full">
              <h3 className="text-white text-lg font-semibold">
                <TranslatableText text="Mood Calendar" forceTranslate={true} />
              </h3>
              <Calendar className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="w-full grid grid-cols-7 gap-1">
              {/* Day labels */}
              {[
                { short: 'S', full: 'Sunday' },
                { short: 'M', full: 'Monday' },
                { short: 'T', full: 'Tuesday' },
                { short: 'W', full: 'Wednesday' },
                { short: 'T', full: 'Thursday' },
                { short: 'F', full: 'Friday' },
                { short: 'S', full: 'Saturday' }
              ].map((day, i) => (
                <div key={i} className="text-[10px] text-center text-[#aaadb0] mb-1">
                  <TranslatableText text={day.short} forceTranslate={true} />
                </div>
              ))}
              
              {/* Calendar cells - realistic mood data pattern */}
              {/* Week 1 */}
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">1</div>
              <div className="aspect-square rounded bg-yellow-500/80 flex items-center justify-center text-[10px] text-white font-medium">2</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">3</div>
              <div className="aspect-square rounded border border-gray-600/50 flex items-center justify-center text-[10px] text-gray-500">4</div>
              <div className="aspect-square rounded bg-red-500/80 flex items-center justify-center text-[10px] text-white font-medium">5</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">6</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">7</div>
              
              {/* Week 2 */}
              <div className="aspect-square rounded bg-yellow-500/80 flex items-center justify-center text-[10px] text-white font-medium">8</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">9</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">10</div>
              <div className="aspect-square rounded bg-yellow-500/80 flex items-center justify-center text-[10px] text-white font-medium">11</div>
              <div className="aspect-square rounded border border-gray-600/50 flex items-center justify-center text-[10px] text-gray-500">12</div>
              <div className="aspect-square rounded border border-gray-600/50 flex items-center justify-center text-[10px] text-gray-500">13</div>
              <div className="aspect-square rounded bg-red-500/80 flex items-center justify-center text-[10px] text-white font-medium">14</div>
              
              {/* Week 3 */}
              <div className="aspect-square rounded bg-yellow-500/80 flex items-center justify-center text-[10px] text-white font-medium">15</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">16</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">17</div>
              <div className="aspect-square rounded bg-yellow-500/80 flex items-center justify-center text-[10px] text-white font-medium">18</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">19</div>
              <div className="aspect-square rounded border border-gray-600/50 flex items-center justify-center text-[10px] text-gray-500">20</div>
              <div className="aspect-square rounded bg-green-500/80 flex items-center justify-center text-[10px] text-white font-medium">21</div>
            </div>
            
            {/* Updated legend matching actual mood calendar */}
            <div className="mt-3 flex items-center justify-center space-x-3">
              <div className="flex items-center">
                <div className="h-3 w-3 rounded bg-green-500/80 mr-1"></div>
                <span className="text-[10px] text-white">
                  <TranslatableText text="Positive" forceTranslate={true} />
                </span>
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 rounded bg-yellow-500/80 mr-1"></div>
                <span className="text-[10px] text-white">
                  <TranslatableText text="Neutral" forceTranslate={true} />
                </span>
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 rounded bg-red-500/80 mr-1"></div>
                <span className="text-[10px] text-white">
                  <TranslatableText text="Negative" forceTranslate={true} />
                </span>
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 rounded border border-gray-600/50 mr-1"></div>
                <span className="text-[10px] text-white">
                  <TranslatableText text="No Entry" forceTranslate={true} />
                </span>
              </div>
            </div>
          </div>
        );
      
      
      default:
        return (
          <div className="p-4 text-center text-white">
            <TranslatableText text="Infographic not found" forceTranslate={true} />
          </div>
        );
    }
  };
  
  return (
    <div className={`${containerStyles} ${className}`}>
      <AspectRatio ratio={16/9} className="bg-[#1A1F2C]/80">
        {renderInfographic()}
      </AspectRatio>
    </div>
  );
};

export default TutorialInfographic;
