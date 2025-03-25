import { Button } from "@/components/ui/button"
import { Database, Mic, PieChart, Loader2 } from "lucide-react"

interface JournalHeaderProps {
  onCreateJournal: () => void;
  onViewInsights: () => void;
  onProcessAllEmbeddings?: () => void;
  isProcessingEmbeddings?: boolean;
}

export function JournalHeader({ 
  onCreateJournal, 
  onViewInsights, 
  onProcessAllEmbeddings,
  isProcessingEmbeddings
}: JournalHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground">
          Record your thoughts and feelings through voice or text
        </p>
      </div>
      <div className="flex gap-2 self-end">
        {onProcessAllEmbeddings && (
          <Button 
            variant="outline" 
            size="sm"
            disabled={isProcessingEmbeddings}
            onClick={onProcessAllEmbeddings}
          >
            {isProcessingEmbeddings ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Index All Entries
              </>
            )}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onViewInsights}>
          <PieChart className="h-4 w-4 mr-2" />
          Insights
        </Button>
        <Button onClick={onCreateJournal}>
          <Mic className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>
    </div>
  );
}
