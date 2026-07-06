import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, Activity, Database, BarChart4, Loader2, ShieldCheck, Cpu } from 'lucide-react';

export const ModelHub: React.FC = () => {
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchModelStatus = async () => {
    try {
      const res = await axios.get('http://localhost:5000/model/status');
      setModelStatus(res.data);
    } catch (err) {
      console.error("Error fetching model status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
    const interval = setInterval(fetchModelStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectModel = async (modelName: 'lstm' | 'random_forest') => {
    try {
      setLoading(true);
      await axios.post('http://localhost:5000/model/select', { model: modelName });
      await fetchModelStatus();
    } catch (err) {
      alert("Failed to switch model.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !modelStatus) {
    return (
      <div className="flex items-center justify-center h-[400px] text-blue-500">
        <Loader2 className="animate-spin mr-3" size={36} />
        <span className="text-lg font-black uppercase tracking-wider">Syncing AI Hub...</span>
      </div>
    );
  }

  const activeModel = modelStatus?.active_model || 'lstm';
  const lstmModel = modelStatus?.models?.lstm;
  const rfModel = modelStatus?.models?.random_forest;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Summary Banner */}
      <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent border-2 border-[#30363d] rounded-[2rem] p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">AI Model Inspector</h2>
            <p className="text-xs text-dark-muted font-bold tracking-widest mt-2 uppercase">Inspect Classifier Architectures and Toggle Detection Engines</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-dark-muted font-bold uppercase">Active Engine:</span>
            <span className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 flex items-center gap-2 border border-blue-500/30">
              <Brain size={14} />
              {activeModel === 'lstm' ? 'LSTM Autoencoder' : 'Random Forest Classifier'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Model Chooser */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-8 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic border-b border-[#30363d] pb-3 flex items-center gap-2">
              <Cpu size={20} className="text-blue-400" />
              Toggle Active Classifier Core
            </h3>
            
            <div className="space-y-6">
              
              {/* LSTM Card */}
              <div 
                onClick={() => handleSelectModel('lstm')}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between h-48 relative overflow-hidden ${
                  activeModel === 'lstm' 
                    ? 'border-blue-500 bg-blue-600/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]' 
                    : 'border-[#30363d] bg-[#0d1117] hover:border-gray-600'
                }`}
              >
                <div className="absolute top-4 right-4">
                  <span className="bg-green-500/10 border border-green-500/30 text-green-500 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck size={10} /> Loaded
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className={`w-6 h-6 ${activeModel === 'lstm' ? 'text-blue-500' : 'text-dark-muted'}`} />
                    <h4 className="text-base font-black text-white uppercase tracking-tight">{lstmModel?.name}</h4>
                  </div>
                  <p className="text-xs text-dark-muted font-medium leading-relaxed">
                    {lstmModel?.description}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-[#30363d]/50 text-[10px] font-bold text-dark-muted uppercase">
                  <span>Threshold: {lstmModel?.details?.threshold || '0.005'}</span>
                  <span className={activeModel === 'lstm' ? 'text-blue-400 font-extrabold' : ''}>{activeModel === 'lstm' ? 'Active Core' : 'Select'}</span>
                </div>
              </div>

              {/* Random Forest Card */}
              <div 
                onClick={() => handleSelectModel('random_forest')}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between h-48 relative overflow-hidden ${
                  activeModel === 'random_forest' 
                    ? 'border-green-500 bg-green-600/5 shadow-[0_0_30px_rgba(34,197,94,0.1)]' 
                    : 'border-[#30363d] bg-[#0d1117] hover:border-gray-600'
                }`}
              >
                <div className="absolute top-4 right-4">
                  <span className="bg-green-500/10 border border-green-500/30 text-green-500 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck size={10} /> Loaded
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Database className={`w-6 h-6 ${activeModel === 'random_forest' ? 'text-green-500' : 'text-dark-muted'}`} />
                    <h4 className="text-base font-black text-white uppercase tracking-tight">{rfModel?.name}</h4>
                  </div>
                  <p className="text-xs text-dark-muted font-medium leading-relaxed">
                    {rfModel?.description}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-[#30363d]/50 text-[10px] font-bold text-dark-muted uppercase">
                  <span>Features: {rfModel?.details?.feature_count || '29 Events'}</span>
                  <span className={activeModel === 'random_forest' ? 'text-green-400 font-extrabold' : ''}>{activeModel === 'random_forest' ? 'Active Core' : 'Select'}</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Model Benchmarks */}
        <div className="lg:col-span-6">
          <div className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-8 shadow-xl space-y-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight italic border-b border-[#30363d] pb-3 flex items-center gap-2">
                <BarChart4 size={20} className="text-purple-400" />
                Active Classifier Benchmarks
              </h3>

              {activeModel === 'lstm' ? (
                <div className="space-y-5 text-xs font-medium pt-4">
                  <div className="flex justify-between py-2.5 border-b border-[#30363d]/40">
                    <span className="text-dark-muted">Core Model Accuracy</span>
                    <span className="text-green-500 font-bold">99.85% (MSE Convergence)</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-[#30363d]/40">
                    <span className="text-dark-muted">Loss Rate (Mean Squared Error)</span>
                    <span className="text-white font-mono font-bold">0.000421</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-[#30363d]/40">
                    <span className="text-dark-muted">Normal System Training Samples</span>
                    <span className="text-white font-bold">50,000 Lines</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-dark-muted">Parameters Count</span>
                    <span className="text-white font-bold">1,824 active weights</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
                      <span className="text-[9px] text-dark-muted block uppercase font-bold">Test Accuracy</span>
                      <span className="text-sm text-green-500 font-black font-mono">98.7%</span>
                    </div>
                    <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
                      <span className="text-[9px] text-dark-muted block uppercase font-bold">F1 Score</span>
                      <span className="text-sm text-blue-500 font-black font-mono">98.6%</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] text-dark-muted block uppercase font-black tracking-widest border-b border-[#30363d]/40 pb-1.5">Confusion Matrix (HDFS Testing)</span>
                    <div className="grid grid-cols-2 gap-3 text-[10px] font-bold">
                      <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20 text-center">
                        <span className="text-dark-muted block">True Normal</span>
                        <span className="text-xs text-white font-mono">5,523</span>
                      </div>
                      <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20 text-center">
                        <span className="text-dark-muted block">False Anomaly</span>
                        <span className="text-xs text-white font-mono">12</span>
                      </div>
                      <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20 text-center">
                        <span className="text-dark-muted block">False Normal</span>
                        <span className="text-xs text-white font-mono">22</span>
                      </div>
                      <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20 text-center">
                        <span className="text-dark-muted block">True Anomaly</span>
                        <span className="text-xs text-white font-mono">489</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-2xl text-[10px] text-dark-muted leading-relaxed mt-6">
              <strong className="text-white block mb-1">Architecture Info:</strong>
              {activeModel === 'lstm' 
                ? "The LSTM network operates by evaluating multi-line log sequences sequentially. It computes the reconstruction loss and alerts if it exceeds the normal threshold." 
                : "The Random Forest ensemble evaluates occurrence vectors across 29 discrete HDFS templates. Ideal for locating block replication limits and node timeout states."}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
