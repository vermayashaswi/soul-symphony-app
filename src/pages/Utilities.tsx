import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="container mx-auto px-4 py-8 max-w-5xl"
      >
        <h1 className="text-3xl font-bold text-center mb-8">Utilities</h1>
        
        <Card className="w-full mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" /> 
              Utilities
            </CardTitle>
            <CardDescription>
              This page will contain various utilities for managing your journal entries.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Currently, there are no available utilities. Check back later for new features.
            </p>
            
            {!user && (
              <Alert variant="default" className="mb-4">
                <AlertTitle>Not signed in</AlertTitle>
                <AlertDescription>
                  You need to be signed in to use utilities.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        <Separator className="my-8" />
        
        {/* Additional utilities can be added here */}
      </motion.div>
    </div>
  );
}
