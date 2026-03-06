import { supabase } from '../supabaseClient';
import { AuditLogEntry } from '../types';

export const logAction = async (
    user: any,
    action: AuditLogEntry['action'],
    entity: AuditLogEntry['entity'],
    details: string,
    metadata?: any
) => {
    if (!supabase || !user) return;

    try {
        const entry = {
            timestamp: new Date().toISOString(),
            user_id: user.id || user.uid || 'unknown',
            user_email: user.email || 'unknown',
            user_name: user.user_metadata?.full_name || user.displayName || user.email?.split('@')[0] || 'Unknown',
            action,
            entity,
            details,
            metadata: metadata || {}
        };

        const { error } = await supabase.from('audit_logs').insert(entry);
        if (error) throw error;
        console.log(`[AUDIT] ${action} ${entity}: ${details}`);
    } catch (error) {
        console.error('Failed to log action:', error);
    }
};

export const fetchAuditLogs = async (limitCount = 100): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limitCount);

        if (error) throw error;
        return (data || []) as AuditLogEntry[];
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
    }
};
