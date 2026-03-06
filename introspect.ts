import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;

fetch(url)
    .then(res => res.json())
    .then(data => {
        const result: any = {};

        const batchesDef = data.definitions?.batches;
        if (batchesDef) {
            result.batches_columns = Object.keys(batchesDef.properties);
        }

        const stDef = data.definitions?.stock_items;
        if (stDef) {
            result.stock_items_columns = Object.keys(stDef.properties);
        }

        fs.writeFileSync('schema_remoto.json', JSON.stringify(result, null, 2));
        console.log('Saved to schema_remoto.json');
    })
    .catch(err => console.error('Erro:', err));
