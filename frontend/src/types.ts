export interface FlowNode {
    node: string;
    status: 'ok' | 'failed';
    reason?: string;
    desc?: string;
}

export interface AnomalyResponse {
    status: 'normal' | 'anomaly';
    confidence: number;
    accuracy?: number;
    detected_issue: string;
    failed_node: string;
    why_it_failed: string;
    root_cause?: string;
    possible_fixes: string[];
    recommendations?: string[];
    flow: FlowNode[];
    features?: {
        errors: number;
        cpu: number;
        disk: number;
    };
    filename?: string;
    raw_log?: string;
    ai_explanation?: string;
    time?: string;
    id?: string;
    timestamp?: string;
    dataset_name?: string;
    dataset_category?: string;
    severity_level?: string;
    file_size_bytes?: number;
    model_used?: string;
    total_lines_scanned?: number;
    error_lines_count?: number;
    parsed_logs?: {
        line: number;
        content: string;
        severity: 'INFO' | 'WARNING' | 'CRITICAL';
        component: string;
    }[];
}

export interface HistoryItem {
    id?: string;
    timestamp: string;
    filename: string;
    dataset_name?: string;
    dataset_category?: string;
    status: 'normal' | 'anomaly';
    confidence: number;
    severity_level?: string;
    detected_issue?: string;
    root_cause?: string;
    why_it_failed?: string;
    recommendations?: string[];
    possible_fixes?: string[];
    model_used?: string;
    failed_node?: string;
    flow?: FlowNode[];
    ai_explanation?: string;
    total_lines_scanned?: number;
    error_lines_count?: number;
    archive_filename?: string;
    file_size_bytes?: number;
}
