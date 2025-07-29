import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { TimeRange } from '@/hooks/use-insights-data';

interface SoulNetNode {
  id: string;
  type: 'theme' | 'emotion';
  name: string;
  score: number;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
}

interface SoulNetLink {
  source: string;
  target: string;
  strength: number;
  percentage: number;
}

interface SoulNetData {
  nodes: SoulNetNode[];
  links: SoulNetLink[];
}

interface SoulNetProps {
  timeRange: TimeRange;
  insightsData: {
    entries: any[];
    allEntries: any[];
    aggregatedEmotionData?: any;
  };
  userId?: string;
}

export function SoulNet({ timeRange, insightsData, userId }: SoulNetProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Process data for visualization
  const processedData = useMemo((): SoulNetData => {
    const entries = insightsData.entries || insightsData.allEntries || [];
    
    if (entries.length === 0) {
      return { nodes: [], links: [] };
    }

    // Extract themes and emotions from entries
    const themeMap = new Map<string, number>();
    const emotionMap = new Map<string, number>();
    const connections = new Map<string, Map<string, number>>();

    entries.forEach((entry) => {
      const themes = entry.themes || [];
      const emotions = entry.emotions || {};

      // Count themes
      themes.forEach((theme: string) => {
        themeMap.set(theme, (themeMap.get(theme) || 0) + 1);
      });

      // Count emotions
      if (typeof emotions === 'object' && emotions !== null) {
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score === 'number' && score > 0) {
            emotionMap.set(emotion, (emotionMap.get(emotion) || 0) + score);
          }
        });
      }

      // Track connections between themes and emotions
      themes.forEach((theme: string) => {
        if (!connections.has(theme)) {
          connections.set(theme, new Map());
        }
        
        Object.entries(emotions || {}).forEach(([emotion, score]) => {
          if (typeof score === 'number' && score > 0) {
            const themeConnections = connections.get(theme)!;
            themeConnections.set(emotion, (themeConnections.get(emotion) || 0) + score);
          }
        });
      });
    });

    // Create nodes
    const nodes: SoulNetNode[] = [];
    
    // Theme nodes
    themeMap.forEach((score, theme) => {
      nodes.push({
        id: `theme-${theme}`,
        type: 'theme',
        name: theme,
        score: score,
      });
    });

    // Emotion nodes
    emotionMap.forEach((score, emotion) => {
      nodes.push({
        id: `emotion-${emotion}`,
        type: 'emotion',
        name: emotion,
        score: score,
      });
    });

    // Create links
    const links: SoulNetLink[] = [];
    
    connections.forEach((emotionScores, theme) => {
      const totalThemeScore = Array.from(emotionScores.values()).reduce((sum, score) => sum + score, 0);
      
      emotionScores.forEach((score, emotion) => {
        const percentage = totalThemeScore > 0 ? (score / totalThemeScore) * 100 : 0;
        
        links.push({
          source: `theme-${theme}`,
          target: `emotion-${emotion}`,
          strength: score,
          percentage: percentage,
        });
      });
    });

    return { nodes, links };
  }, [insightsData]);

  // D3 visualization setup
  useEffect(() => {
    if (!svgRef.current || processedData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = isMobile ? 350 : 600;
    const height = isMobile ? 300 : 400;

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    // Create simulation
    const simulation = d3.forceSimulation(processedData.nodes as any)
      .force('link', d3.forceLink(processedData.links)
        .id((d: any) => d.id)
        .distance(80)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links
    const link = g.selectAll('.link')
      .data(processedData.links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', 'hsl(var(--muted-foreground))')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d) => Math.max(1, d.strength / 10));

    // Create nodes
    const node = g.selectAll('.node')
      .data(processedData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Add shapes for nodes
    node.each(function(d) {
      const nodeGroup = d3.select(this);
      
      if (d.type === 'theme') {
        // Sphere (circle) for themes
        nodeGroup.append('circle')
          .attr('r', Math.max(15, Math.min(30, d.score * 3)))
          .attr('fill', 'hsl(var(--primary))')
          .attr('stroke', 'hsl(var(--primary-foreground))')
          .attr('stroke-width', 2);
      } else {
        // Cube (rect) for emotions
        const size = Math.max(12, Math.min(24, d.score * 2));
        nodeGroup.append('rect')
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('x', -size)
          .attr('y', -size)
          .attr('fill', 'hsl(var(--accent))')
          .attr('stroke', 'hsl(var(--accent-foreground))')
          .attr('stroke-width', 2);
      }
    });

    // Add labels
    const labels = g.selectAll('.label')
      .data(processedData.nodes)
      .enter().append('foreignObject')
      .attr('class', 'label')
      .attr('width', 100)
      .attr('height', 40)
      .attr('x', -50)
      .attr('y', 35);

    labels.append('xhtml:div')
      .style('text-align', 'center')
      .style('font-size', isMobile ? '10px' : '12px')
      .style('font-weight', '500')
      .style('color', 'hsl(var(--foreground))')
      .each(function(d) {
        // Use React to render TranslatableText
        const container = d3.select(this);
        container.html(`<div class="translatable-text">${d.name}</div>`);
      });

    // Add percentage labels for emotions when connected
    const percentageLabels = g.selectAll('.percentage')
      .data(processedData.links.filter(l => selectedNode && l.source === selectedNode))
      .enter().append('text')
      .attr('class', 'percentage')
      .style('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', 'hsl(var(--muted-foreground))')
      .text(d => `${d.percentage.toFixed(1)}%`);

    // Node interactions
    node.on('click', function(event, d) {
      setSelectedNode(selectedNode === d.id ? null : d.id);
    })
    .on('mouseenter', function(event, d) {
      setHoveredNode(d.id);
    })
    .on('mouseleave', function() {
      setHoveredNode(null);
    });

    // Update simulation
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      labels.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      percentageLabels.attr('transform', (d: any) => `translate(${d.target.x},${d.target.y - 20})`);
    });

    // Apply selection effects
    if (selectedNode) {
      const connectedNodes = new Set([selectedNode]);
      processedData.links.forEach(link => {
        if (link.source === selectedNode) {
          connectedNodes.add(link.target);
        }
        if (link.target === selectedNode) {
          connectedNodes.add(link.source);
        }
      });

      // Fade non-connected nodes
      node.style('opacity', (d: any) => connectedNodes.has(d.id) ? 1 : 0.1);
      
      // Update link visibility and width
      link
        .style('opacity', (d: any) => 
          d.source.id === selectedNode || d.target.id === selectedNode ? 0.8 : 0.05)
        .attr('stroke-width', (d: any) => 
          d.source.id === selectedNode || d.target.id === selectedNode 
            ? Math.max(2, d.percentage / 10) 
            : 1);

      // Add pulsing animation to connected nodes
      node.filter((d: any) => connectedNodes.has(d.id))
        .select('circle, rect')
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr('r', function() {
          const current = d3.select(this).attr('r');
          return current ? +current * 1.2 : 20;
        })
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr('r', function() {
          const current = d3.select(this).attr('r');
          return current ? +current / 1.2 : 15;
        });
    } else {
      // Reset all styles
      node.style('opacity', 1);
      link.style('opacity', 0.3).attr('stroke-width', (d: any) => Math.max(1, d.strength / 10));
    }

  }, [processedData, selectedNode, isMobile]);

  if (processedData.nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "bg-background rounded-xl shadow-sm border p-6 text-center",
          isMobile ? "mx-2" : "mx-0"
        )}
      >
        <p className="text-muted-foreground">
          <TranslatableText text="No data available for Soul-Net visualization" />
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className={cn(
        "bg-background rounded-xl shadow-sm border overflow-hidden",
        isMobile ? "mx-2" : "mx-0"
      )}
      whileHover={{ boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
    >
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          <TranslatableText text="Soul-Net" />
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          <TranslatableText text="Interactive visualization of your emotional patterns and life themes" />
        </p>
        {selectedNode && (
          <p className="text-xs text-muted-foreground mt-2">
            <TranslatableText text="Click a node to explore connections. Click again to reset." />
          </p>
        )}
      </div>
      
      <div className="p-4 flex justify-center">
        <svg ref={svgRef} className="max-w-full h-auto" />
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary border-2 border-primary-foreground" />
            <TranslatableText text="Themes" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-accent border-2 border-accent-foreground" />
            <TranslatableText text="Emotions" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}