
import React, { useRef, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

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

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        backgroundColor="#181826"
        nodeThreeObject={node => {
          if (node.type === "category" || node.type === "entity") {
            // Create canvas to draw emoji large and crisp
            const emoji = getEmojiForCategory(node.name || node.id);

            // Create a canvas for high-res emoji rendering
            const canvas = document.createElement("canvas");
            const size = 256; // Very large base size
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              // Black drop shadow for contrast
              ctx.shadowColor = "#000";
              ctx.shadowBlur = 32;
              ctx.font = `bold 200px sans-serif`;
              ctx.fillText(emoji, size / 2, size / 2);
            }
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
            });
            const sprite = new THREE.Sprite(spriteMaterial);

            // Make the emoji node sprite huge
            sprite.scale.set(14, 14, 1); // width, height, depth (tune as needed)
            return sprite;
          } else {
            // Optional: return a small dot for other types
            const geometry = new THREE.SphereGeometry(0.6, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: "#666" });
            return new THREE.Mesh(geometry, material);
          }
        }}
        nodeRelSize={8} // just to be safe, but we override with sprite scale
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
