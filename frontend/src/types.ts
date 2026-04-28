export interface FlowNode {
    node: string;
    status: 'ok' | 'failed';
    reason?: string;
    desc?: string;
}

export interface AnomalyResponse {
    status: 'normal' | 'anomaly';
    confidence: number;
    detected_issue: string;
    failed_node: string;
    why_it_failed: string;
    possible_fixes: string[];
    flow: FlowNode[];
    features?: {
        errors: number;
        cpu: number;
        disk: number;
    };
    filename?: string;
    raw_log?: string;
}

export interface HistoryItem {
    timestamp: string;
    filename: string;
    status: 'normal' | 'anomaly';
    confidence: number;
}
