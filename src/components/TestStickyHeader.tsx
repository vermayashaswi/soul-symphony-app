
import React from 'react';
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

const TestStickyHeader = () => {
  const navigate = useNavigate();
  
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">App Loading Test Complete</h1>
      <p className="text-muted-foreground">
        The application has loaded successfully! The JavaScript errors have been resolved.
      </p>
      
      <div className="space-y-2">
        <p>Now let's test the sticky header:</p>
        <Button 
          onClick={() => navigate('/app/smart-chat')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Go to Smart Chat (Test Sticky Header)
        </Button>
        
        <Button 
          onClick={() => navigate('/')}
          variant="outline"
        >
          Back to Homepage
        </Button>
      </div>
      
      <div className="bg-muted p-4 rounded">
        <h3 className="font-semibold mb-2">Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Go to Smart Chat" above</li>
          <li>Once in the chat interface, scroll down in the conversation area</li>
          <li>Verify that the header with "Rūḥ" title stays at the top</li>
          <li>Verify that the input area stays at the bottom</li>
          <li>The middle content area should scroll independently</li>
        </ol>
      </div>
    </div>
  );
};

export default TestStickyHeader;
