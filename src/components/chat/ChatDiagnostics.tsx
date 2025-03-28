
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import { MessageReference } from './ChatArea';

interface DiagnosticsStep {
  id: number;
  step: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  details?: string;
  timestamp?: string;
}

interface ChatDiagnosticsProps {
  queryText: string;
  isVisible: boolean;
  ragSteps: DiagnosticsStep[];
  references: MessageReference[] | null | undefined;
  similarityScores: { id: number, score: number }[] | null;
}

export default function ChatDiagnostics({
  queryText,
  isVisible,
  ragSteps,
  references,
  similarityScores
}: ChatDiagnosticsProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (!isVisible) return null;
  
  // Helper function to format similarity score as percentage
  const formatSimilarityScore = (score: number): string => {
    return `${(score * 100).toFixed(2)}%`;
  };

  // Helper function to find similarity score for an entry
  const findSimilarityScore = (entryId: number): string => {
    // First check if the reference has a similarity property
    const reference = references?.find(ref => ref.id === entryId);
    if (reference?.similarity !== undefined) {
      return formatSimilarityScore(reference.similarity);
    }
    
    // Then check in similarityScores array
    const scoreEntry = similarityScores?.find(s => s.id === entryId);
    if (scoreEntry?.score !== undefined) {
      return formatSimilarityScore(scoreEntry.score);
    }
    
    return "N/A";
  };
  
  return (
    <div className="border rounded-md my-4 bg-background/50 backdrop-blur-sm text-sm">
      <div 
        className="p-3 border-b flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-medium">RAG Diagnostics</h3>
        <Button variant="ghost" size="sm">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      
      {expanded && (
        <div className="p-3">
          <h4 className="font-medium mb-2">Query</h4>
          <pre className="bg-muted p-2 rounded text-xs mb-4 whitespace-pre-wrap">{queryText}</pre>
          
          <h4 className="font-medium mb-2">RAG Pipeline Steps</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ragSteps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell>{step.step}</TableCell>
                  <TableCell>
                    {step.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    {step.status === 'loading' && (
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {step.status === 'pending' && <span className="text-muted-foreground">Pending</span>}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">{step.details || "-"}</TableCell>
                  <TableCell>{step.timestamp || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {references && references.length > 0 && (
            <>
              <h4 className="font-medium mt-4 mb-2">Retrieved References</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry ID</TableHead>
                    <TableHead>Similarity Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Content Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {references.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell>{ref.id}</TableCell>
                      <TableCell>{findSimilarityScore(ref.id)}</TableCell>
                      <TableCell>{new Date(ref.date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{ref.snippet || "No content"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
