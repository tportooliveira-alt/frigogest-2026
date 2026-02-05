
import { addDoc, collection, getDocs, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { AuditLogEntry } from '../types';

export const logAction = async (
    user: any,
    action: AuditLogEntry['action'],
    entity: AuditLogEntry['entity'],
    details: string,
    metadata?: any
) => {
    if (!db || !user) return;

    try {
        const entry: Omit<AuditLogEntry, 'id'> = {
            timestamp: new Date().toISOString(),
            userId: user.uid || 'unknown',
            userEmail: user.email || 'unknown',
            userName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
            action,
            entity,
            details,
            metadata: metadata || {}
        };

        await addDoc(collection(db, 'audit_logs'), entry);
        console.log(`[AUDIT] ${action} ${entity}: ${details}`);
    } catch (error) {
        console.error('Failed to log action:', error);
    }
};

export const fetchAuditLogs = async (limitCount = 100): Promise<AuditLogEntry[]> => {
    if (!db) return [];

    try {
        const q = query(
            collection(db, 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AuditLogEntry));
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
    }
};
