import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [{name:'local-reference-data', configureServer(server) {
    server.middlewares.use('/__local_contacts',(_req,res)=>{const p=path.resolve('private-data/contacts-v2.json');if(!fs.existsSync(p)){res.statusCode=404;return res.end();}res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(p));});
    server.middlewares.use('/__local_update',(_req,res)=>{const p=path.resolve('private-data/replacement.json');if(!fs.existsSync(p)){res.statusCode=404;return res.end();}res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(p));});
    server.middlewares.use('/__local_seed', (_req,res)=>{
      const p=path.resolve('private-data/seed.json');
      if(!fs.existsSync(p)){res.statusCode=404;return res.end('No local reference data');}
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store'); res.end(fs.readFileSync(p));
    });
    server.middlewares.use('/__local_file', (req,res)=>{
      const id=new URL(req.url,'http://localhost').searchParams.get('id');
      if(!/^[1-5]$/.test(id||'')){res.statusCode=404;return res.end();}
      const p=path.resolve(`private-data/original-${id}.xlsx`);
      if(!fs.existsSync(p)){res.statusCode=404;return res.end();}
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(p));
    });
  }}],
  server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{strict:true}},
  build:{target:'es2022',rollupOptions:{output:{manualChunks:{excel:['xlsx'],supabase:['@supabase/supabase-js'],zip:['fflate']}}}}
});
