
import React from "react";
import { Card } from "@/components/ui/card";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsDisplayProps {
  analysisData: any;
}

const AnalyticsDisplay: React.FC<AnalyticsDisplayProps> = ({ analysisData }) => {
  if (!analysisData) return null;

  // Simple chart data visualization if data is in the right format
  if (analysisData.chartData && Array.isArray(analysisData.chartData)) {
    return (
      <div className="mt-4">
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-2">
            <TranslatableText text={analysisData.chartTitle || "Analysis Results"} />
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analysisData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                  name={analysisData.valueName || "Value"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {analysisData.chartDescription && (
            <p className="text-xs text-muted-foreground mt-2">
              <TranslatableText text={analysisData.chartDescription} />
            </p>
          )}
        </Card>
      </div>
    );
  }

  // Fallback for when the data structure doesn't match expected format
  return (
    <div className="mt-4">
      <Card className="p-3">
        <div className="text-sm">
          <div className="font-medium mb-1">
            <TranslatableText text="Analysis Summary" />
          </div>
          <div className="text-xs text-muted-foreground">
            <TranslatableText text={analysisData.summary || JSON.stringify(analysisData)} />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsDisplay;
