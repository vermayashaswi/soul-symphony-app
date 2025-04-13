
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic, Globe } from "lucide-react";

interface ModelSelectorProps {
  selectedModel: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onChange, disabled = false }: ModelSelectorProps) {
  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor="stt-model" className="text-xs text-muted-foreground">
        Transcription Model
      </label>
      <Select
        value={selectedModel}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id="stt-model" className="w-full h-9 text-sm">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="openai">
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5" />
              <span>OpenAI Whisper</span>
            </div>
          </SelectItem>
          <SelectItem value="google">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Google Speech</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
