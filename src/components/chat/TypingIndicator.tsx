
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface TypingIndicatorProps {
  messages?: string[];
  speed?: number;
}

const defaultMessages = [
  "Thinking...",
  "Analyzing...",
  "Exploring...",
  "Processing...",
  "Reflecting...",
  "Searching...",
];

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  messages = defaultMessages,
  speed = 2000,
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");

  // Rotate through the messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, speed);

    return () => clearInterval(messageInterval);
  }, [messages.length, speed]);

  // Animate the ellipsis
  useEffect(() => {
    const dotStates = ["", ".", "..", "..."];
    let currentIndex = 0;

    const dotsInterval = setInterval(() => {
      setDots(dotStates[currentIndex]);
      currentIndex = (currentIndex + 1) % dotStates.length;
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <TranslatableText text={messages[messageIndex]} />
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="inline-block min-w-[18px]"
      >
        {dots}
      </motion.span>
    </div>
  );
};
