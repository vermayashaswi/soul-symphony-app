
import { Button } from "@/components/ui/button";
import { DatabaseIcon, PlusIcon, RefreshIcon, Search, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useJournalHandler } from "@/hooks/use-journal-handler";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface JournalHeaderProps {
  onSearchChange: (value: string) => void;
  searchQuery: string;
  onRefresh: () => void;
}

export function JournalHeader({ onSearchChange, searchQuery, onRefresh }: JournalHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { handleCreateJournal, handleViewInsights, processUnprocessedEntries, isProcessingUnprocessedEntries } = useJournalHandler(user?.id);

  const handleProcessEntries = async () => {
    try {
      toast.loading("Processing journal entries...", {
        id: "process-entries",
        duration: 10000,
      });
      
      const result = await processUnprocessedEntries();
      
      toast.dismiss("process-entries");
      
      if (result.success) {
        const count = result.processedCount || 0;
        if (count > 0) {
          toast.success(`Successfully processed ${count} journal entries`);
          // Refresh the journal list to show updated entries
          onRefresh();
        } else {
          toast.info("No unprocessed entries found");
        }
      } else {
        toast.error("Failed to process journal entries");
      }
    } catch (error) {
      toast.dismiss("process-entries");
      toast.error("Error processing journal entries");
      console.error("Error processing entries:", error);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">Journal Entries</h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search entries..."
            className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-4 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleProcessEntries}
                  disabled={isProcessingUnprocessedEntries}
                >
                  <DatabaseIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Process unprocessed entries</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onRefresh}>
                  <RefreshIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleViewInsights}>
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Insights</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button onClick={handleCreateJournal}>
            <PlusIcon className="mr-2 h-4 w-4" /> New Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
