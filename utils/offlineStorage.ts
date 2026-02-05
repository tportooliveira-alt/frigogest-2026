// Sistema de armazenamento offline usando localStorage
// Simula o comportamento do Supabase para desenvolvimento sem internet

interface OfflineData {
    batches: any[];
    stock_items: any[];
    sales: any[];
    clients: any[];
    financial: any[];
    expeditions: any[];
}

const STORAGE_KEY = 'frigogest_offline_data';

// Inicializa dados de exemplo se não existirem
const initializeOfflineData = (): OfflineData => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        return JSON.parse(stored);
    }

    const initialData: OfflineData = {
        batches: [],
        stock_items: [],
        sales: [],
        clients: [
            { id: '1', nome_social: 'Cliente Varejo', cpf_cnpj: '000.000.000-00', telefone: '', email: '', endereco: '' }
        ],
        financial: [],
        expeditions: []
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
};

// Simula queries do Supabase
export const offlineStorage = {
    // SELECT
    from: (table: keyof OfflineData) => ({
        select: (fields: string = '*') => ({
            eq: (field: string, value: any) => {
                const data = initializeOfflineData();
                const filtered = data[table].filter((item: any) => item[field] === value);
                return Promise.resolve({ data: filtered, error: null });
            },
            order: (field: string, options?: any) => {
                const data = initializeOfflineData();
                let sorted = [...data[table]];
                if (options?.ascending === false) {
                    sorted.sort((a, b) => b[field] > a[field] ? 1 : -1);
                } else {
                    sorted.sort((a, b) => a[field] > b[field] ? 1 : -1);
                }
                return Promise.resolve({ data: sorted, error: null });
            },
            then: (callback: any) => {
                const data = initializeOfflineData();
                return Promise.resolve({ data: data[table], error: null }).then(callback);
            }
        }),
        // INSERT
        insert: (newData: any) => {
            const data = initializeOfflineData();
            const withId = Array.isArray(newData)
                ? newData.map(item => ({ ...item, id: item.id || Date.now().toString() + Math.random() }))
                : { ...newData, id: newData.id || Date.now().toString() + Math.random() };

            if (Array.isArray(withId)) {
                data[table].push(...withId);
            } else {
                data[table].push(withId);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return Promise.resolve({ data: withId, error: null });
        },
        // UPDATE
        update: (updates: any) => ({
            eq: (field: string, value: any) => {
                const data = initializeOfflineData();
                data[table] = data[table].map((item: any) =>
                    item[field] === value ? { ...item, ...updates } : item
                );
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return Promise.resolve({ data: updates, error: null });
            }
        }),
        // DELETE
        delete: () => ({
            eq: (field: string, value: any) => {
                const data = initializeOfflineData();
                data[table] = data[table].filter((item: any) => item[field] !== value);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return Promise.resolve({ data: null, error: null });
            }
        })
    }),

    // Auth mockado
    auth: {
        signInWithPassword: ({ email, password }: any) => {
            // Aceita qualquer credencial no modo offline
            const user = { id: 'offline-user', email };
            return Promise.resolve({
                data: { user, session: { access_token: 'offline-token' } },
                error: null
            });
        },
        signOut: () => Promise.resolve({ error: null }),
        getSession: () => Promise.resolve({
            data: { session: { access_token: 'offline-token' } },
            error: null
        })
    }
};

export default offlineStorage;
