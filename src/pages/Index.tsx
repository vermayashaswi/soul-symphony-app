import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import BackendTester from '@/components/BackendTester';

export default function Index() {
  return (
    <div className="container py-8 max-w-6xl">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Your Personal Journal</h1>
        <p className="text-muted-foreground mt-4">
          Capture your thoughts, track your emotions, and gain insights into your inner world.
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Start Journaling</h2>
          <p className="text-muted-foreground mb-6">
            Begin your journey of self-discovery by creating your first journal entry.
          </p>
          <Link to="/journal">
            <Button className="w-full">
              Go to Journal <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>

        <div className="p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Explore Insights</h2>
          <p className="text-muted-foreground mb-6">
            Uncover patterns and trends in your journal entries to better understand yourself.
          </p>
          <Link to="/insights">
            <Button className="w-full">
              View Insights <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
      
      <section className="my-12">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Backend Connection Tests</h2>
        <BackendTester />
      </section>

      <footer className="text-center mt-12">
        <p className="text-muted-foreground">
          © {new Date().getFullYear()} Your Journal. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
