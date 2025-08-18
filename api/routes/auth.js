// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// A CHAVE SECRETA CONTINUA AQUI
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_e_aleatoria';

// AGORA O MÓDULO INTEIRO É UMA FUNÇÃO QUE RECEBE O 'pool'
module.exports = (pool) => {
    const router = express.Router();

    // Middleware para verificar o token JWT e obter o usuário
    const authenticateToken = async (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token == null) {
            return res.status(401).json({ message: 'Token de autenticação ausente.' });
        }

        jwt.verify(token, JWT_SECRET, async (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'Token inválido ou expirado.' });
            }
            
            try {
                // AGORA USA O 'pool' QUE FOI PASSADO COMO PARÂMETRO
                const result = await pool.query('SELECT current_session_token FROM usuarios WHERE id = $1', [user.id]);
                const dbUser = result.rows[0];

                if (!dbUser) {
                    return res.status(403).json({ message: 'Usuário não encontrado ou sessão inválida.' });
                }
            } catch (dbError) {
                console.error('Erro ao verificar sessão no banco de dados:', dbError);
                return res.status(500).json({ message: 'Erro interno do servidor ao verificar sessão.' });
            }

            req.user = user;
            next();
        });
    };

    // Middleware para verificar se o usuário tem um dos níveis de acesso permitidos
    const authorizeRoles = (allowedRoles) => {
        return (req, res, next) => {
            if (!req.user || !allowedRoles.includes(req.user.nivel_acesso)) {
                return res.status(403).json({ message: 'Acesso negado. Você não tem as permissões necessárias.' });
            }
            next();
        };
    };

    // ====================================================================
    // ROTAS DE AUTENTICAÇÃO
    // ====================================================================

    // Rota de Login
    router.post('/login', async (req, res) => {
        const { login_usuario, password } = req.body;

        if (!login_usuario || !password) {
            return res.status(400).json({ error: 'Login de usuário e senha são obrigatórios.' });
        }

        try {
            const result = await pool.query('SELECT id, login_usuario, password_hash, nivel_acesso, nome, adhesion_field_permissions FROM usuarios WHERE login_usuario = $1', [login_usuario]);
            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const tokenPayload = { 
                id: user.id, 
                login_usuario: user.login_usuario, 
                nivel_acesso: user.nivel_acesso 
            };

            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' }); // Aumentei o tempo de expiração

            await pool.query('UPDATE usuarios SET current_session_token = $1 WHERE id = $2', [token, user.id]);

            res.status(200).json({
                message: 'Login bem-sucedido!',
                token,
                user: {
                    id: user.id,
                    login_usuario: user.login_usuario,
                    nivel_acesso: user.nivel_acesso,
                    nome: user.nome,
                    adhesion_field_permissions: user.adhesion_field_permissions || {}
                }
            });
        } catch (error) {
            console.error('Erro durante o login:', error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    // Rota de Logout
    router.post('/logout', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            await pool.query('UPDATE usuarios SET current_session_token = NULL WHERE id = $1', [userId]);
            res.status(200).json({ message: 'Logout bem-sucedido.' });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor ao fazer logout.' });
        }
    });
    
    // ... TODAS AS OUTRAS ROTAS CONTINUAM AQUI DENTRO ...
    // (criação, atualização, deleção de usuários, etc.)
    // Elas já usarão o 'pool' correto automaticamente.

    // Rota para obter todos os usuários
    router.get('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
        try {
            const result = await pool.query('SELECT id, login_usuario, nome, nivel_acesso, adhesion_field_permissions FROM usuarios ORDER BY login_usuario ASC');
            res.status(200).json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor ao buscar usuários.' });
        }
    });

    // Rota para criar um novo usuário
    router.post('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
        const { login_usuario, password, nome, nivel_acesso, adhesion_field_permissions } = req.body;
        // ... (código da rota sem alterações)
        if (!login_usuario || !password || !nome || !nivel_acesso) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: 'A senha deve ter no mínimo 8 caracteres.' });
        }
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const permissionsJson = JSON.stringify(adhesion_field_permissions || {});
            const query = 'INSERT INTO usuarios (login_usuario, password_hash, nome, nivel_acesso, adhesion_field_permissions) VALUES ($1, $2, $3, $4, $5) RETURNING id, login_usuario, nome, nivel_acesso, adhesion_field_permissions';
            const result = await pool.query(query, [login_usuario, hashedPassword, nome, nivel_acesso, permissionsJson]);
            res.status(201).json({ message: 'Usuário criado com sucesso!', user: result.rows[0] });
        } catch (error) {
            if (error.code === '23505') { // Código de violação de unicidade
                return res.status(409).json({ message: 'Nome de usuário já existe.' });
            }
            res.status(500).json({ message: 'Erro interno do servidor ao criar usuário.' });
        }
    });

    // Rota para atualizar um usuário
    router.put('/users/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
        const { id } = req.params;
        const { nome, nivel_acesso, password, adhesion_field_permissions } = req.body;
        // ... (código da rota sem alterações)
        if (!nome && !nivel_acesso && !password && adhesion_field_permissions === undefined) {
            return res.status(400).json({ message: 'Nenhum campo para atualização fornecido.' });
        }
        try {
            let queryParts = [];
            let queryParams = [];
            let paramIndex = 1;
            if (nome !== undefined) {
                queryParts.push(`nome = $${paramIndex++}`);
                queryParams.push(nome);
            }
            if (nivel_acesso !== undefined) {
                queryParts.push(`nivel_acesso = $${paramIndex++}`);
                queryParams.push(nivel_acesso);
            }
            if (adhesion_field_permissions !== undefined) {
                queryParts.push(`adhesion_field_permissions = $${paramIndex++}`);
                queryParams.push(JSON.stringify(adhesion_field_permissions));
            }
            if (password) {
                if (password.length < 8) {
                    return res.status(400).json({ message: 'A nova senha deve ter no mínimo 8 caracteres.' });
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                queryParts.push(`password_hash = $${paramIndex++}`);
                queryParams.push(hashedPassword);
            }
            queryParams.push(id);
            const queryText = `UPDATE usuarios SET ${queryParts.join(', ')} WHERE id = $${paramIndex} RETURNING id, login_usuario, nome, nivel_acesso, adhesion_field_permissions`;
            const result = await pool.query(queryText, queryParams);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Usuário não encontrado.' });
            }
            res.status(200).json({ message: 'Usuário atualizado com sucesso!', user: result.rows[0] });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor ao atualizar usuário.' });
        }
    });

    // Rota para deletar um usuário
    router.delete('/users/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
        const { id } = req.params;
        // ... (código da rota sem alterações)
        try {
            const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Usuário não encontrado.' });
            }
            res.status(200).json({ message: 'Usuário deletado com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor ao deletar usuário.' });
        }
    });
    
    // RETORNA O OBJETO COM O ROUTER E OS MIDDLEWARES
    return { router, authenticateToken, authorizeRoles };
};