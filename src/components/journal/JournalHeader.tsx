
import React from 'react';
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TranslatableText } from '@/components/translation/TranslatableText';

const JournalHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between py-2">
      <h1 className="text-xl font-semibold text-foreground">
        <TranslatableText text="Your journal entries" />
      </h1>
      <Button 
        size="sm" 
        className="space-x-1"
        onClick={() => navigate('/journal/record')}
      >
        <TranslatableText text="New entry" />
      </Button>
    </div>
  );
};

export default JournalHeader;
