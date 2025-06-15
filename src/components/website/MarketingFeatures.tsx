
import React from "react";

const FEATURES = [
  {
    title: "Voice Journaling",
    description: "Speak your thoughts and feelings and let SOULo transcribe them for you. Journaling has never been this effortless.",
    img: "/lovable-uploads/185c449b-b8f9-435d-b91b-3638651c0d06.png",
  },
  {
    title: "AI Insights",
    description: "Receive AI-powered emotional insights after every entry. Understand yourself better, spot patterns, and grow.",
    img: "/lovable-uploads/3eeb2da1-ba02-4cd6-b5f7-100f72896921.png",
  },
  {
    title: "Mood Tracking",
    description: "Automatically track your mood and themes over time, visualized beautifully to guide your personal growth.",
    img: "/lovable-uploads/1b346540-75b4-4095-8860-2446c46aea4c.png",
  },
  {
    title: "Your Data Stays Yours",
    description: "Export or delete your data any time. We never sell or share your information, and our privacy policy is clear.",
    img: "/lovable-uploads/69a98431-43ec-41e5-93f1-7ddaf28e2884.png",
  },
];

const MarketingFeatures = () => (
  <section id="features" className="bg-gray-50 py-16">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">Why SOULo?</h2>
      <div className="grid md:grid-cols-2 gap-12">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="p-6 rounded-2xl bg-white flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="w-20 h-20 flex-shrink-0 overflow-hidden rounded-2xl border">
              <img src={feature.img} alt={feature.title} className="object-cover w-full h-full" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default MarketingFeatures;
