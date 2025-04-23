
import React, { useRef, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { getTwemojiUrlForEntity } from "./entityEmojiUtils";

// Emoji mapping logic from your prompt
const getEmojiForCategory = (category: string) => {
  const emojiMap: Record<string, string> = {
    "Mental Health": "🧠",
    "Romantic Relationships": "❤️",
    "Family": "👨‍👩‍👧",
    "Money & Finance": "💰",
    "Self & Identity": "🧍",
    "Friendships & Social Circle": "👥",
    "Sleep & Rest": "🛌",
    "Education & Learning": "📚",
    "Celebration & Achievement": "🎉"
  };
  return emojiMap[category] || "🔘"; // Default fallback emoji
};

interface ForceGraph3DVisualizationProps {
  data: {
    nodes: { id: string; name: string; type: string }[];
    links: { source: string; target: string }[];
  };
}

const ForceGraph3DVisualization: React.FC<ForceGraph3DVisualizationProps> = ({ data }) => {
  const fgRef = useRef<any>(null);

  // Optional: fit graph to canvas after render
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(700, 100);
    }
  }, [data]);

  // Preload entity emojis to ensure they're available when needed
  useEffect(() => {
    // Preload all entity emojis
    data.nodes.forEach(node => {
      if (node.type === "entity") {
        const img = new Image();
        img.src = getTwemojiUrlForEntity(node.name || node.id);
      }
    });
  }, [data]);

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        backgroundColor="#181826"
        nodeLabel={node => node.id}
        nodeThreeObject={node => {
          if (node.type === "category" || node.type === "entity") {
            // For entity nodes, use the SVG Twemoji
            const emojiUrl = getTwemojiUrlForEntity(node.name || node.id);
            
            // Create a sprite using the Twemoji SVG URL
            const texture = new THREE.TextureLoader().load(emojiUrl);
            const material = new THREE.SpriteMaterial({ 
              map: texture,
              transparent: true,
              depthWrite: false,
              sizeAttenuation: true
            });
            const sprite = new THREE.Sprite(material);
            
            // Make the sprite much larger
            sprite.scale.set(25, 25, 1);
            return sprite;
          } else {
            // For emotion nodes, use colored cubes
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            const material = new THREE.MeshLambertMaterial({ color: "#9b87f5" });
            return new THREE.Mesh(geometry, material);
          }
        }}
        nodeRelSize={8}
        enableNodeDrag={true}
        nodeAutoColorBy="type"
        linkWidth={2}
        linkColor={() => "#9b87f5"}
        linkOpacity={0.7}
      />
    </div>
  );
};

export default ForceGraph3DVisualization;
