
declare module 'react-force-graph-3d' {
  import React from 'react';
  
  interface NodeObject {
    id: string;
    name?: string;
    type?: string;
    [key: string]: any;
  }

  interface LinkObject {
    source: string | NodeObject;
    target: string | NodeObject;
    [key: string]: any;
  }

  interface ForceGraph3DProps {
    graphData: {
      nodes: NodeObject[];
      links: LinkObject[];
    };
    nodeThreeObject?: (node: NodeObject) => any;
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeAutoColorBy?: string | ((node: NodeObject) => string);
    nodeColor?: string | ((node: NodeObject) => string);
    nodeRelSize?: number;
    linkWidth?: number | ((link: LinkObject) => number);
    linkColor?: string | ((link: LinkObject) => string);
    linkOpacity?: number;
    linkDirectionalArrowLength?: number;
    linkDirectionalArrowRelPos?: number;
    backgroundColor?: string;
    enableNodeDrag?: boolean;
    enableNavigationControls?: boolean;
    showNavInfo?: boolean;
    ref?: React.Ref<any>;
    width?: number;
    height?: number;
    [key: string]: any;
  }

  export default React.ForwardRefExoticComponent<
    ForceGraph3DProps & React.RefAttributes<any>
  >;
}
