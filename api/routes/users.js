// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
// REMOVIDO: const jwt = require('jsonwebtoken');
require('dotenv').config(); // Para carregar variáveis de ambiente

// Configuração do Pool de conexão com o banco de dados
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'guaruja',
    password: process.env.DB_PASSWORD || 'root',
    port: process.env.DB_PORT || 5432,
});

// REMOVIDO: Middleware authenticateToken
// REMOVIDO: Middleware authorizeAdmin

// ====================================================================
// ROTAS DE AUTENTICAÇÃO (AGORA SEM SEGURANÇA)
// ====================================================================

// Rota de Login (agora sem autenticação real, apenas verifica credenciais)
router.post('/login', async (req, res) => {
    const { login_usuario, password_hash } = req.body; // 'password_hash' é a senha em texto puro

    if (!login_usuario || !password_hash) {
        return res.status(400).json({ error: 'Login de usuário e senha são obrigatórios.' });
    }

    try {
        const result = await pool.query('SELECT id, login_usuario, password_hash, nivel_acesso, nome FROM usuarios WHERE login_usuario = $1', [login_usuario]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        // Comparação de senha em texto puro
        const isMatch = (password_hash === user.password_hash); 

        if (!isMatch) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        // REMOVIDO: Geração de JWT. Não há token.
        res.status(200).json({ message: 'Login bem-sucedido!', user: { login_usuario: user.login_usuario, nivel_acesso: user.nivel_acesso, nome: user.nome } });
    } catch (error) {
        console.error('Erro durante o login:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// REMOVIDO: Rota para verificar o status de administrador (/check-admin)

// ====================================================================
// ROTAS PARA GESTÃO DE UTILIZADORES (AGORA PÚBLICAS)
// ====================================================================

// Rota para obter todos os usuários (AGORA PÚBLICA)
router.get('/users', async (req, res) => { // REMOVIDO: authenticateToken, authorizeAdmin
    try {
        const result = await pool.query('SELECT id, login_usuario, nome, nivel_acesso FROM usuarios ORDER BY login_usuario ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar usuários.' });
    }
});

// Rota para criar um novo usuário (AGORA PÚBLICA)
router.post('/users', async (req, res) => { // REMOVIDO: authenticateToken, authorizeAdmin
    const { login_usuario, password, nome, nivel_acesso } = req.body; // 'password' é a senha em texto puro

    if (!login_usuario || !password || !nome || !nivel_acesso) {
        return res.status(400).json({ message: 'Todos os campos (usuário, senha, nome, nível de acesso) são obrigatórios.' });
    }

    try {
        const userExists = await pool.query('SELECT id FROM usuarios WHERE login_usuario = $1', [login_usuario]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ message: 'Nome de usuário já existe.' });
        }

        const plainTextPassword = password; 

        const query = 'INSERT INTO usuarios (login_usuario, password_hash, nome, nivel_acesso) VALUES ($1, $2, $3, $4) RETURNING id, login_usuario, nome, nivel_acesso';
        const values = [login_usuario, plainTextPassword, nome, nivel_acesso];
        const result = await pool.query(query, values);

        res.status(201).json({ message: 'Usuário criado com sucesso!', user: result.rows[0] });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar usuário.' });
    }
});

// Rota para atualizar um usuário (AGORA PÚBLICA)
router.put('/users/:id', async (req, res) => { // REMOVIDO: authenticateToken, authorizeAdmin
    const { id } = req.params;
    const { nome, nivel_acesso, password } = req.body; // 'password' é a nova senha em texto puro (opcional)

    if (!nome && !nivel_acesso && !password) {
        return res.status(400).json({ message: 'Nenhum campo para atualização fornecido.' });
    }

    try {
        const userExists = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        let queryParts = [];
        let queryParams = [];
        let paramIndex = 1;

        if (nome !== undefined) {
            queryParts.push(`nome = $${paramIndex}`);
            queryParams.push(nome);
            paramIndex++;
        }
        if (nivel_acesso !== undefined) {
            queryParts.push(`nivel_acesso = $${paramIndex}`);
            queryParams.push(nivel_acesso);
            paramIndex++;
        }
        if (password) {
            queryParts.push(`password_hash = $${paramIndex}`);
            queryParams.push(password);
            paramIndex++;
        }

        queryParams.push(id); // O ID é sempre o último parâmetro

        const queryText = `UPDATE usuarios SET ${queryParts.join(', ')} WHERE id = $${paramIndex}`;
        await pool.query(queryText, queryParams);
        res.status(200).json({ message: 'Usuário atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar usuário.' });
    }
});

// Rota para deletar um usuário (AGORA PÚBLICA)
router.delete('/users/:id', async (req, res) => { // REMOVIDO: authenticateToken, authorizeAdmin
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.status(200).json({ message: 'Usuário deletado com sucesso!', deletedId: id });
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao deletar usuário.' });
    }
});

module.exports = router;
