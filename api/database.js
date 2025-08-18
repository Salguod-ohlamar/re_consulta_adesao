// backend/database.js
const { Pool } = require('pg');
require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas

// Configuração do Pool de conexão com o banco de dados
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'guaruja',
    password: process.env.DB_PASSWORD || 'root',
    port: process.env.DB_PORT || 5432,
    // Adicione SSL para Vercel/produção se o seu DB exigir
     ssl: {
        rejectUnauthorized: false, // Use true em produção com certificado válido
     },
});

// Teste de conexão (opcional, mas útil para depuração)
pool.on('connect', () => {
    console.log('Conectado ao banco de dados PostgreSQL.');
});

pool.on('error', (err) => {
    console.error('Erro inesperado no pool do banco de dados:', err);
    process.exit(-1); // Encerra o processo se houver um erro fatal na conexão
});

module.exports = pool;
