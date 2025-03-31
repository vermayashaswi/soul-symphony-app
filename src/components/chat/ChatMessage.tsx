
import React from "react";
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
    references?: any[];
    diagnostics?: any;
  };
  showAnalysis: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, showAnalysis }) => {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          message.role === 'user' 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}
      >
        {message.role === 'assistant' ? (
          <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none">
            {message.content}
          </ReactMarkdown>
        ) : (
          <p>{message.content}</p>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.analysis && (
          <div className="mt-2 text-xs opacity-70">
            <Separator className="my-2" />
            <div className="font-semibold">Analysis:</div>
            <p>{message.analysis.analysis}</p>
            {message.analysis.requiresSql && (
              <>
                <div className="font-semibold mt-1">SQL Query:</div>
                <pre className="text-xs bg-black/10 p-1 rounded overflow-x-auto">
                  {message.analysis.sqlQuery}
                </pre>
              </>
            )}
          </div>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.diagnostics && renderDiagnostics(message.diagnostics)}
        
        {message.role === 'assistant' && message.references && renderReferences(message.references)}
      </div>
    </div>
  );
};

const renderReferences = (references: any[]) => {
  if (!references || references.length === 0) return null;
  
  return (
    <div className="mt-2 text-xs">
      <Separator className="my-2" />
      <div className="font-semibold">Based on {references.length} journal entries:</div>
      <div className="max-h-40 overflow-y-auto mt-1">
        {references.slice(0, 3).map((ref, idx) => (
          <div key={idx} className="mt-1 border-l-2 border-primary pl-2 py-1">
            <div className="font-medium">{new Date(ref.date).toLocaleDateString()}</div>
            <div className="text-muted-foreground">{ref.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderDiagnostics = (diagnostics: any) => {
  if (!diagnostics) return null;
  
  return (
    <div className="mt-2 text-xs">
      <Separator className="my-2" />
      <div className="font-semibold">Query Diagnostics:</div>
      <div className="max-h-60 overflow-y-auto mt-1 bg-slate-800 p-2 rounded text-slate-200">
        {diagnostics.query_plan && (
          <div>
            <div className="font-medium">Sample Answer:</div>
            <div className="text-xs whitespace-pre-wrap mb-2">{diagnostics.query_plan.sample_answer}</div>
            
            <div className="font-medium">Execution Plan:</div>
            {diagnostics.query_plan.execution_plan.map((segment: any, idx: number) => (
              <div key={idx} className="mb-2 border-l-2 border-blue-500 pl-2">
                <div><span className="font-medium">Segment:</span> {segment.segment}</div>
                <div><span className="font-medium">Type:</span> {segment.segment_type}</div>
                {segment.sql_query && (
                  <div>
                    <span className="font-medium">SQL:</span>
                    <pre className="text-xs overflow-x-auto">{segment.sql_query}</pre>
                  </div>
                )}
                {segment.vector_search && (
                  <div><span className="font-medium">Vector Search:</span> {segment.vector_search}</div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {diagnostics.execution_results && (
          <div className="mt-2">
            <div className="font-medium">Execution Results:</div>
            {diagnostics.execution_results.execution_results.map((result: any, idx: number) => (
              <div key={idx} className="mb-2 border-l-2 border-green-500 pl-2">
                <div><span className="font-medium">Segment:</span> {result.segment}</div>
                <div><span className="font-medium">Type:</span> {result.type}</div>
                {result.error ? (
                  <div className="text-red-400"><span className="font-medium">Error:</span> {result.error}</div>
                ) : (
                  <div>
                    <span className="font-medium">Result:</span>
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(result.result, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
