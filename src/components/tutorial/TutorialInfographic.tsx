
import React from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Book, ChartLine, Calendar, GridIcon } from 'lucide-react';

// Define the different infographic types
export type InfographicType = 'insights-overview' | 'emotion-trends' | 'mood-calendar' | 'soul-net';

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
              <h3 className="text-white text-lg font-semibold">Emotional Insights</h3>
              <Book className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">Top Emotion</div>
                <div className="text-white font-medium">Happiness</div>
                <div className="w-full h-2 bg-[#1A1F2C] rounded-full mt-2">
                  <div className="h-full rounded-full" style={{ width: '70%', backgroundColor: colors.primary }}></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">This Week</div>
                <div className="text-white font-medium">Positive Trend</div>
                <div className="w-full h-2 bg-[#1A1F2C] rounded-full mt-2">
                  <div className="h-full rounded-full" style={{ width: '85%', backgroundColor: colors.brightBlue }}></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">Entries</div>
                <div className="text-white font-medium">24 Total</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#9b87f5]"></div>
                </div>
              </div>
              <div className="bg-[#2D243A] p-3 rounded-lg border border-[#9b87f5]/30">
                <div className="text-xs text-[#aaadb0] mb-1">Time Range</div>
                <div className="text-white font-medium">Last 30 Days</div>
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
              <h3 className="text-white text-lg font-semibold">Emotion Trends</h3>
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
                <div className="absolute bottom-[-20px] left-[25%] text-[10px] text-[#aaadb0]">Week 1</div>
                <div className="absolute bottom-[-20px] left-[50%] text-[10px] text-[#aaadb0]">Week 2</div>
                <div className="absolute bottom-[-20px] left-[75%] text-[10px] text-[#aaadb0]">Week 3</div>
                
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
                <span className="text-[10px] text-white mr-3">Joy</span>
                <div className="h-3 w-3 rounded-full bg-[#33C3F0] mr-1"></div>
                <span className="text-[10px] text-white">Calm</span>
              </div>
            </div>
          </div>
        );
      
      case 'mood-calendar':
        return (
          <div className="p-4 flex flex-col items-center">
            <div className="mb-3 flex items-center justify-center w-full">
              <h3 className="text-white text-lg font-semibold">Mood Calendar</h3>
              <Calendar className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="w-full grid grid-cols-7 gap-1">
              {/* Day labels */}
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-[10px] text-center text-[#aaadb0]">{day}</div>
              ))}
              
              {/* Calendar cells - first week */}
              <div className="aspect-square rounded bg-[#9b87f5]/20 flex items-center justify-center text-[10px] text-white">1</div>
              <div className="aspect-square rounded bg-[#9b87f5]/50 flex items-center justify-center text-[10px] text-white">2</div>
              <div className="aspect-square rounded bg-[#9b87f5]/30 flex items-center justify-center text-[10px] text-white">3</div>
              <div className="aspect-square rounded bg-[#9b87f5]/10 flex items-center justify-center text-[10px] text-white">4</div>
              <div className="aspect-square rounded bg-[#9b87f5]/80 flex items-center justify-center text-[10px] text-white">5</div>
              <div className="aspect-square rounded bg-[#9b87f5]/60 flex items-center justify-center text-[10px] text-white">6</div>
              <div className="aspect-square rounded bg-[#9b87f5]/40 flex items-center justify-center text-[10px] text-white">7</div>
              
              {/* Calendar cells - second week */}
              <div className="aspect-square rounded bg-[#9b87f5]/30 flex items-center justify-center text-[10px] text-white">8</div>
              <div className="aspect-square rounded bg-[#9b87f5]/90 flex items-center justify-center text-[10px] text-white">9</div>
              <div className="aspect-square rounded bg-[#9b87f5]/70 flex items-center justify-center text-[10px] text-white">10</div>
              <div className="aspect-square rounded bg-[#9b87f5]/50 flex items-center justify-center text-[10px] text-white">11</div>
              <div className="aspect-square rounded bg-[#9b87f5]/20 flex items-center justify-center text-[10px] text-white">12</div>
              <div className="aspect-square rounded bg-[#9b87f5]/40 flex items-center justify-center text-[10px] text-white">13</div>
              <div className="aspect-square rounded bg-[#9b87f5]/60 flex items-center justify-center text-[10px] text-white">14</div>
            </div>
            
            {/* Legend */}
            <div className="mt-3 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-[#9b87f5]/20 mr-1"></div>
              <span className="text-[10px] text-white mr-2">Low</span>
              <div className="h-3 w-3 rounded-full bg-[#9b87f5]/50 mr-1"></div>
              <span className="text-[10px] text-white mr-2">Medium</span>
              <div className="h-3 w-3 rounded-full bg-[#9b87f5]/90 mr-1"></div>
              <span className="text-[10px] text-white">High</span>
            </div>
          </div>
        );
      
      case 'soul-net':
        return (
          <div className="p-4 flex flex-col items-center">
            <div className="mb-3 flex items-center justify-center w-full">
              <h3 className="text-white text-lg font-semibold">Soul-Net Visualization</h3>
              <GridIcon className="ml-2 text-[#9b87f5]" size={iconSize} />
            </div>
            <div className="w-full h-[140px] relative">
              {/* Center node */}
              <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-12 h-12 rounded-full bg-[#9b87f5] flex items-center justify-center">
                  <span className="text-xs text-white font-medium">YOU</span>
                </div>
              </div>
              
              {/* Connections and nodes */}
              <svg className="absolute inset-0 h-full w-full">
                {/* Connections */}
                <line x1="50%" y1="50%" x2="30%" y2="30%" stroke={colors.primary} strokeWidth="2" />
                <line x1="50%" y1="50%" x2="70%" y2="30%" stroke={colors.skyBlue} strokeWidth="2" />
                <line x1="50%" y1="50%" x2="30%" y2="70%" stroke={colors.light} strokeWidth="2" />
                <line x1="50%" y1="50%" x2="70%" y2="70%" stroke={colors.tertiary} strokeWidth="2" />
                <line x1="50%" y1="50%" x2="15%" y2="50%" stroke={colors.brightBlue} strokeWidth="2" />
                <line x1="50%" y1="50%" x2="85%" y2="50%" stroke={colors.secondary} strokeWidth="2" />
                
                {/* Emotion/Life area nodes */}
                <circle cx="30%" cy="30%" r="15" fill={colors.primary} />
                <circle cx="70%" cy="30%" r="15" fill={colors.skyBlue} />
                <circle cx="30%" cy="70%" r="15" fill={colors.light} />
                <circle cx="70%" cy="70%" r="15" fill={colors.tertiary} />
                <circle cx="15%" cy="50%" r="15" fill={colors.brightBlue} />
                <circle cx="85%" cy="50%" r="15" fill={colors.secondary} />
              </svg>
              
              {/* Node labels */}
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '25%', left: '28%', transform: 'translate(-50%, -50%)' }}>Work</div>
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '25%', left: '72%', transform: 'translate(-50%, -50%)' }}>Health</div>
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '75%', left: '28%', transform: 'translate(-50%, -50%)' }}>Family</div>
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '75%', left: '72%', transform: 'translate(-50%, -50%)' }}>Joy</div>
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '50%', left: '15%', transform: 'translate(-50%, -50%)' }}>Stress</div>
              <div className="absolute text-[10px] text-white font-medium" style={{ top: '50%', left: '85%', transform: 'translate(-50%, -50%)' }}>Peace</div>
            </div>
          </div>
        );
      
      default:
        return <div className="p-4 text-center text-white">Infographic not found</div>;
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
