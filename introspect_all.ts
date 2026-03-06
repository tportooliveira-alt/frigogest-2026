import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;

fetch(url)
    .then(res => res.json())
    .then(data => {
        const tables = Object.keys(data.definitions || {});
        const result = {
            all_tables: tables
        };

        fs.writeFileSync('schema_remoto_all.json', JSON.stringify(result, null, 2));
        console.log('Saved to schema_remoto_all.json');
    })
    .catch(err => console.error('Erro:', err));
