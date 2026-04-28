import React, { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import { FlowNode } from './types';

interface ServiceGraphProps {
  flowData: FlowNode[];
}

const nodeTypes = {
  custom: CustomNode,
};

const ServiceGraph: React.FC<ServiceGraphProps> = ({ flowData }) => {
  const nodes: Node[] = useMemo(() => {
    return flowData.map((item, index) => ({
      id: index.toString(),
      type: 'custom',
      data: { 
        label: item.node, 
        status: item.status, 
        desc: item.desc || (item.status === 'ok' ? 'Healthy' : 'Error Detected')
      },
      position: { x: index * 250, y: 100 },
    }));
  }, [flowData]);

  const edges: Edge[] = useMemo(() => {
    const e: Edge[] = [];
    for (let i = 0; i < flowData.length - 1; i++) {
      const isTargetHealthy = flowData[i+1].status === 'ok';
      e.push({
        id: `e${i}-${i+1}`,
        source: i.toString(),
        target: (i + 1).toString(),
        animated: isTargetHealthy,
        style: { 
            stroke: isTargetHealthy ? '#2ea043' : '#f85149',
            strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isTargetHealthy ? '#2ea043' : '#f85149',
        },
      });
    }
    return e;
  }, [flowData]);

  return (
    <div className="h-[500px] w-full bg-[#0d1117] rounded-2xl border-2 border-[#30363d] overflow-hidden shadow-2xl relative">
      <div className="absolute top-4 left-4 z-10 bg-[#161b22]/80 backdrop-blur px-3 py-1 rounded-full border border-[#30363d] text-[10px] text-dark-muted font-bold tracking-widest uppercase">
        Live Network Topology
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_, node) => {
            const data = flowData[parseInt(node.id)];
            if (data.status === 'failed') {
                alert(`⚠️ CRITICAL FAILURE AT: ${data.node}\n\nREASON: ${data.desc || 'Request timeout'}\n\nCheck the Possible Fixes panel for more details.`);
            }
        }}
      >
        <Background color="#30363d" gap={25} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default ServiceGraph;
