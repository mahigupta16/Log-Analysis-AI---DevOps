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
  onNodeSelect: (node: any) => void;
}

const nodeTypes = {
  custom: CustomNode,
};

const ServiceGraph: React.FC<ServiceGraphProps> = ({ flowData, onNodeSelect }) => {
  const nodes: Node[] = useMemo(() => {
    return flowData.map((item, index) => {
      let position = { x: index * 250, y: 150 };
      if (flowData.length === 5) {
        if (index === 0) position = { x: 50, y: 150 };
        else if (index === 1) position = { x: 260, y: 150 };
        else if (index === 2) position = { x: 470, y: 40 };      // Upper Branch
        else if (index === 3) position = { x: 470, y: 260 };     // Lower Branch
        else if (index === 4) position = { x: 680, y: 150 };     // Sink/Merge
      }
      return {
        id: index.toString(),
        type: 'custom',
        data: { 
          label: item.node, 
          status: item.status, 
          desc: item.desc || (item.status === 'ok' ? 'Healthy' : 'Error Detected')
        },
        position,
      };
    });
  }, [flowData]);

  const edges: Edge[] = useMemo(() => {
    const e: Edge[] = [];
    if (flowData.length === 5) {
      const connections = [
        { s: 0, t: 1 },
        { s: 1, t: 2 },
        { s: 1, t: 3 },
        { s: 2, t: 4 },
        { s: 3, t: 4 }
      ];
      connections.forEach(({ s, t }) => {
        const isTargetHealthy = flowData[t].status === 'ok';
        e.push({
          id: `e${s}-${t}`,
          source: s.toString(),
          target: t.toString(),
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
      });
    } else {
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
    }
    return e;
  }, [flowData]);

  const getNodeDefinition = (nodeLabel: string) => {
    const name = nodeLabel.toLowerCase();
    if (name.includes("user") || name.includes("client")) {
      return "The Client/User layer represents origin client requests (e.g. applications, developers, or browsers) initiating request entries to our infrastructure.";
    } else if (name.includes("gateway") || name.includes("firewall")) {
      return "The API Gateway / Firewall is the single entry point that secures traffic, routes requests, and monitors network security logs.";
    } else if (name.includes("namenode")) {
      return "The HDFS NameNode is the master director of the distributed file system. It stores filesystem metadata, folders, and coordinates worker DataNodes.";
    } else if (name.includes("datanode")) {
      return "HDFS DataNodes are the actual database blocks/worker nodes that store file split blocks on local disks and write them on request.";
    } else if (name.includes("replication")) {
      return "The block replication process makes copies of files across multiple DataNodes to protect against hardware crashes and data losses.";
    } else if (name.includes("postgres") || name.includes("master") || name.includes("replica") || name.includes("db")) {
      return "Relational Database Node containing transaction entries. It is vital for serving active data writes and queries.";
    } else if (name.includes("kernel")) {
      return "The Linux OS Kernel connects hardware to software. It allocates CPU cycles, RAM heap space, and schedules hardware disk controller storage tasks.";
    } else if (name.includes("systemd")) {
      return "Systemd is the parent process manager that handles starting/stopping system services, microservice daemons, and syslog configurations.";
    } else if (name.includes("sshd") || name.includes("auth")) {
      return "SSHD is the secure login gateway allowing developers to attach secure shell commands and manage configs remotely.";
    } else if (name.includes("agent") || name.includes("collector")) {
      return "Monitoring agent checking hardware parameters (CPU spikes, memory allocation boundaries, network bandwidth, disk storage).";
    }
    return "System component participating in routing and service tasks.";
  };

  const getRemediationSteps = (nodeLabel: string) => {
    const name = nodeLabel.toLowerCase();
    if (name.includes("datanode") || name.includes("namenode") || name.includes("replication")) {
      return [
        "Verify network routing between NameNode master and storage workers.",
        "Run HDFS health diagnostic report: `hdfs dfsadmin -report`.",
        "Restart the failed DataNode node service: `systemctl restart hadoop-datanode`."
      ];
    } else if (name.includes("postgres") || name.includes("master") || name.includes("replica") || name.includes("db")) {
      return [
        "Log in to database console and verify active SQL thread limits.",
        "Identify blocked processes using query: `SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL`.",
        "Increase max connection parameter or scale connection pool limit: `ALTER SYSTEM SET max_connections = 200;`."
      ];
    } else if (name.includes("sshd") || name.includes("auth")) {
      return [
        "Inspect secure authentication log records: `tail -n 50 /var/log/auth.log`.",
        "Block intruder IP using Firewall rule: `iptables -A INPUT -s <IP> -j DROP`.",
        "Force public-key only credentials inside `sshd_config` configuration."
      ];
    } else if (name.includes("disk") || name.includes("mount") || name.includes("storage")) {
      return [
        "Locate heavy directory files using: `du -sh /var/log/* | sort -h`.",
        "Clear old compressed logs and software package caches: `apt-get clean`.",
        "Extend storage blocks size or mount another filesystem volume."
      ];
    }
    return [
      "Restart service process daemon and inspect syslog logs.",
      "Review recent application source updates and configuration yaml settings.",
      "Check cpu load averages and free ram allocation limits."
    ];
  };

  return (
    <div className="flex flex-col lg:flex-row h-[500px] w-full bg-[#0d1117] rounded-[2rem] border-2 border-[#30363d] overflow-hidden shadow-2xl relative">
      
      {/* ReactFlow Canvas */}
      <div className="flex-1 h-full relative border-b lg:border-b-0 lg:border-r border-[#30363d]">
        <div className="absolute top-4 left-4 z-10 bg-[#161b22]/90 backdrop-blur px-4 py-1.5 rounded-full border border-[#30363d] text-[10px] text-blue-400 font-bold tracking-widest uppercase">
          Live Service Topology Graph
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => {
              const data = flowData[parseInt(node.id)];
              onNodeSelect({
                  label: data.node,
                  status: data.status,
                  desc: data.desc || (data.status === 'ok' ? 'Healthy' : 'Error Detected'),
                  definition: getNodeDefinition(data.node),
                  remediation: getRemediationSteps(data.node)
              });
          }}
        >
          <Background color="#30363d" gap={25} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Interactive Glossary Sidebar */}
      <div className="w-full lg:w-80 bg-[#161b22] p-6 flex flex-col justify-between overflow-y-auto border-t lg:border-t-0 border-[#30363d]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#30363d] pb-2">Node Glossary</h3>
          <div className="space-y-4">
            {flowData.map((item, index) => {
              let desc = "Standard system service node participating in the request flow.";
              const name = item.node.toLowerCase();
              if (name.includes("user") || name.includes("client")) {
                desc = "The origin client or developer making API requests to the cluster.";
              } else if (name.includes("gateway") || name.includes("firewall")) {
                desc = "Traffic manager enforcing safety rules and routing streams.";
              } else if (name.includes("namenode")) {
                desc = "HDFS master director recording block locations and cluster metadata.";
              } else if (name.includes("datanode")) {
                desc = "Data storage nodes holding file blocks and streaming disk chunks on request.";
              } else if (name.includes("replication")) {
                desc = "Data replication daemon syncing copies to backup block locations.";
              } else if (name.includes("postgres") || name.includes("master") || name.includes("replica") || name.includes("db")) {
                desc = "Relational database server containing the system's operational tables.";
              } else if (name.includes("kernel")) {
                desc = "Linux OS core scheduling CPU time, memory limits, and hardware drivers.";
              } else if (name.includes("systemd")) {
                desc = "System init manager maintaining background services and system daemon cycles.";
              } else if (name.includes("sshd") || name.includes("auth")) {
                desc = "SSH daemon validating login authentications and shell attachments.";
              } else if (name.includes("agent") || name.includes("collector")) {
                desc = "Metric collector auditing host logs and memory utilization statistics.";
              }
              
              return (
                <div 
                  key={index} 
                  className="text-xs group hover:bg-[#0d1117] p-2.5 rounded-lg transition-all border border-transparent hover:border-[#30363d] cursor-pointer" 
                  onClick={() => onNodeSelect({ 
                    label: item.node, 
                    status: item.status, 
                    desc: item.desc || (item.status === 'ok' ? 'Healthy' : 'Error Detected'),
                    definition: getNodeDefinition(item.node),
                    remediation: getRemediationSteps(item.node)
                  })}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${item.status === 'ok' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                    <span className="font-bold text-white font-mono">{item.node}</span>
                  </div>
                  <p className="text-dark-muted font-medium leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="pt-4 border-t border-[#30363d] text-[10px] text-dark-muted text-center italic font-bold">
          Tip: Click on nodes to view detailed diagnostics modal.
        </div>
      </div>

    </div>
  );
};

export default ServiceGraph;
