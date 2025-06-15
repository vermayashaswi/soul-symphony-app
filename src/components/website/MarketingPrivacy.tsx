
import React from "react";

const MarketingPrivacy = () => (
  <section id="privacy" className="bg-white py-16">
    <div className="container mx-auto px-4 max-w-2xl text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">Your Privacy Comes First</h2>
      <p className="text-gray-700 text-lg mb-4">
        With SOULo, everything is private by default. Your data is always encrypted, and you can export or delete it at any moment.
      </p>
      <a
        href="/privacy-policy"
        className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition"
      >
        Read Our Privacy Policy
      </a>
    </div>
  </section>
);

export default MarketingPrivacy;
