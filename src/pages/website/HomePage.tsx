
// This is a partial update to replace just the processSteps array in HomePage.tsx

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
        "/lovable-uploads/7f0aed08-e705-4a7e-ad94-39e85472b340.png", // Updated to use the new uploaded image
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
