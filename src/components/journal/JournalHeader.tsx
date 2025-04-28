import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TranslatableText } from '@/components/translation/TranslatableText';

const JournalHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-foreground">
        <TranslatableText text="Journal" />
      </h1>
      <div className="flex items-center space-x-2">
      </div>
    </div>
  );
};

export default JournalHeader;
