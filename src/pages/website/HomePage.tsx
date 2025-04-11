
import React from 'react';
import { Mic, Brain, LineChart, Calendar, MessageSquare } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";

// This is a complete file replacement for HomePage.tsx

const processSteps = [
  {
    step: "1",
    title: "Record Your Thoughts",
    description: [
      "Speak freely in any language about your day, feelings, or thoughts",
      "Works even in noisy environments and understands multiple languages",
      "No writing required - just talk naturally as you would to a friend",
      "Automatic transcription saves your spoken words into text format"
    ],
    image: "/lovable-uploads/eb66a92e-1044-4a85-9380-4790da9cf683.png",
    icon: Mic
  },
  {
    step: "2",
    title: "AI Analyzes Your Entry",
    description: [
      "Our AI transcribes your voice and analyzes emotional patterns and themes",
      "Automatically recognizes key entities like people, places, and things",
      "Creates searchable tags to help you easily filter and find past entries",
      "Identifies recurring themes and patterns in your journaling"
    ],
    image: "/lovable-uploads/185c449b-b8f9-435d-b91b-3638651c0d06.png",
    icon: Brain
  },
  {
    step: "3a",
    title: "Analyze Your Emotional Patterns",
    description: [
      "Filter insights using customizable time ranges (day, week, month, year)",
      "See your dominant moods and what emotions appear most in your entries",
      "Track your biggest emotional changes and their intensity over time",
      "View your journaling activity stats and streaks"
    ],
    images: [
      "/lovable-uploads/d61c0a45-1846-4bde-b495-f6b8c58a2951.png",
      "/lovable-uploads/86f40c9c-bea5-4d03-9eb3-7336786f1bbb.png", 
      "/lovable-uploads/71907497-c7a1-4288-9799-bbd229b480ad.png"
    ],
    icon: LineChart,
    multiplePhones: true
  },
  {
    step: "3b",
    title: "Visualize Your Emotional Journey",
    description: [
      "See graphical representations of emotion score movements over time",
      "Explore emotional bubbles that define your personality and their intensities",
      "View your overall sentiment changes in interactive calendar format",
      "Identify patterns in your mood with color-coded visual guides"
    ],
    images: [
      "/lovable-uploads/7f0aed08-e705-4a7e-ad94-39e85472b340.png",
      "/lovable-uploads/1b346540-75b4-4095-8860-2446c46aea4c.png"
    ],
    icon: Calendar,
    multiplePhones: true
  },
  {
    step: "4",
    title: "Chat with Your Journal",
    description: [
      "Have a conversation with \"Rūḥ\", an emotionally intelligent AI assistant",
      "Ask questions about your past entries and get insightful responses",
      "Receive personalized guidance specific to your own journal entries",
      "Get contextual advice on mental health and emotional wellbeing"
    ],
    image: "/lovable-uploads/1c377509-f91d-4c41-9289-dc867a89a90e.png",
    icon: MessageSquare
  }
];

const HomePage = () => {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Experience the Power of Voice Journaling</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Keep a journal and capture your day without writing down a single word
          </p>
        </div>

        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our innovative process combines voice journaling with AI analysis for meaningful insights
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-16">
            {processSteps.map((step, index) => (
              <div key={step.step} className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-full md:w-1/2 order-2 md:order-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      {React.createElement(step.icon, { className: "w-6 h-6 text-primary" })}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Step {step.step}</span>
                      <h3 className="text-2xl font-bold">{step.title}</h3>
                    </div>
                  </div>
                  
                  <ul className="space-y-2 ml-6 list-disc text-muted-foreground">
                    {step.description.map((item, i) => (
                      <li key={i} className="text-base">{item}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="w-full md:w-1/2 order-1 md:order-2">
                  {step.multiplePhones ? (
                    <Carousel className="w-full">
                      <CarouselContent>
                        {step.images?.map((img, imgIndex) => (
                          <CarouselItem key={imgIndex}>
                            <div className="flex justify-center">
                              <div className="relative w-[280px] h-[580px] border-8 border-black rounded-[40px] overflow-hidden shadow-lg">
                                <div className="absolute top-0 left-0 right-0 h-4 bg-black z-10"></div>
                                <div className="absolute bottom-0 left-0 right-0 h-4 bg-black z-10"></div>
                                <div className="w-full h-full overflow-hidden">
                                  <AspectRatio ratio={9/19.5} className="bg-white">
                                    <img src={img} alt={`${step.title} screen ${imgIndex + 1}`} className="w-full h-full object-cover" />
                                  </AspectRatio>
                                </div>
                              </div>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex justify-center gap-2 mt-4">
                        <CarouselPrevious className="relative left-0 translate-x-0 h-8 w-8 rounded-full" />
                        <CarouselNext className="relative right-0 translate-x-0 h-8 w-8 rounded-full" />
                      </div>
                    </Carousel>
                  ) : (
                    <div className="flex justify-center">
                      <div className="relative w-[280px] h-[580px] border-8 border-black rounded-[40px] overflow-hidden shadow-lg">
                        <div className="absolute top-0 left-0 right-0 h-4 bg-black z-10"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-4 bg-black z-10"></div>
                        <div className="w-full h-full overflow-hidden">
                          <AspectRatio ratio={9/19.5} className="bg-white">
                            <img src={step.image} alt={step.title} className="w-full h-full object-cover" />
                          </AspectRatio>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
