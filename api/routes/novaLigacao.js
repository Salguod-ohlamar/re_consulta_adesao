// backend/routes/novaLigacao.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Garante que o diretório para uploads temporários exista
const uploadDir = path.join(__dirname, '..', 'tmp', 'csv_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Mapeamento de comunidades para prefixos
const PREFIXOS_MATRICULA = {
    "jardim cachoeira": "JC",
    "jardim primavera": "JP",
    "pereque": "PQ",
    "morrinhos iii": "MT",
    "morrinhos iv": "MT",
    "mar e ceu": "MC",
    "areiao": "AR",
    "barreira": "BA",
    "cantagalo": "CG",
    "pedreira matarazo": "PM"
};

// Esta função cria e retorna o router.
// Ela recebe 'app' e 'pool' para poder acessar o banco de dados.
module.exports = (app, pool) => {
    const router = express.Router();
    // Pega os middlewares de autenticação e autorização do app principal
    const { authenticateToken, authorizeRoles } = app.locals; 

    // Função para gerar a próxima matrícula
    async function generateNextMatricula(comunidade) {
        const comunidadeNormalizada = comunidade.toLowerCase().trim();
        const prefixo = PREFIXOS_MATRICULA[comunidadeNormalizada];

        if (!prefixo) {
            throw new Error(`Prefixo não definido para a comunidade: ${comunidade}`);
        }

        const query = `
            SELECT MATRICULA FROM nova_ligacao
            WHERE MATRICULA LIKE $1 || '%'
            ORDER BY MATRICULA DESC
            LIMIT 1
        `;
        const result = await pool.query(query, [prefixo]);
        const lastMatricula = result.rows[0] ? result.rows[0].matricula : null;

        let lastNumber = 0;
        if (lastMatricula) {
            const match = lastMatricula.match(/(\d+)$/);
            if (match) {
                lastNumber = parseInt(match[1]);
            }
        }
        const nextNumber = lastNumber + 1;
        // Formata com 4 dígitos para garantir mais combinações, ex: JC0001
        return `${prefixo}${String(nextNumber).padStart(4, '0')}`;
    }

    // Protege todas as rotas neste arquivo
    router.use(authenticateToken);

    // Rota para buscar uma nova ligação pela matrícula (para o modal de detalhes)
    router.get('/nova_ligacao/:matricula', async (req, res) => {
        const { matricula } = req.params;

        if (!matricula) {
            return res.status(400).json({ message: 'Matrícula não fornecida.' });
        }

        try {
            const query = 'SELECT fotos FROM nova_ligacao WHERE matricula = $1';
            const { rows } = await pool.query(query, [matricula]);

            if (rows.length > 0) {
                res.status(200).json(rows[0]);
            } else {
                res.status(404).json({ message: 'Nenhuma ligação encontrada para esta matrícula.' });
            }
        } catch (error) {
            console.error(`Erro ao buscar dados da nova ligação para a matrícula ${matricula}:`, error);
            res.status(500).json({ message: 'Erro interno do servidor.' });
        }
    });

    // Rota de upload para o arquivo CSV de Novas Ligações
    router.post('/upload-nova-ligacao-csv', 
        authorizeRoles(['admin', 'backoffice']), // Apenas admin e backoffice podem importar
        upload.single('csvFile'), 
        async (req, res) => {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo CSV enviado.' });
            }

            const results = [];
            const filePath = req.file.path;

            try {
                fs.createReadStream(filePath)
                    .pipe(csv()) // Assumindo separador vírgula por padrão, ajuste se necessário
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        fs.unlinkSync(filePath); // Remove o arquivo temporário

                        let insertedCount = 0;
                        const errors = [];

                        for (const row of results) {
                            try {
                                const comunidade = row['COMUNIDADE'];
                                if (!comunidade) {
                                    throw new Error('Campo COMUNIDADE ausente na linha.');
                                }

                                const matriculaGerada = await generateNextMatricula(comunidade);
                                
                                const query = `
                                    INSERT INTO nova_ligacao (
                                        DIGITO, MATRICULA, COD_ANTIGO, COMUNIDADE, RUA, NUMERO,
                                        COMPLEMENTO, NUMERO_COMPLEMENTO, "ENDEREÇO COMPLETO", FOTOS
                                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                                `;
                                const values = [
                                    row['DIGITO'], matriculaGerada, row['COD_ANTIGO'], row['COMUNIDADE'],
                                    row['RUA'], row['NUMERO'], row['COMPLEMENTO'], row['NUMERO_COMPLEMENTO'],
                                    row['ENDEREÇO COMPLETO'], row['FOTOS']
                                ];
                                await pool.query(query, values);
                                insertedCount++;
                            } catch (rowError) {
                                console.error('Erro ao processar linha do CSV:', rowError.message, row);
                                errors.push(`Linha com erro: ${JSON.stringify(row)} - ${rowError.message}`);
                            }
                        }

                        if (errors.length > 0) {
                            return res.status(207).json({ 
                                message: `Processamento concluído com ${insertedCount} registros inseridos e ${errors.length} erros.`,
                                errors: errors 
                            });
                        } else {
                            res.status(200).json({ message: `Arquivo CSV de Nova Ligação processado com sucesso! ${insertedCount} registros inseridos.` });
                        }
                    });
            } catch (error) {
                console.error('Erro ao processar arquivo CSV de Nova Ligação:', error);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                res.status(500).json({ error: 'Erro interno do servidor ao processar o arquivo CSV.' });
            }
        }
    );

    // Anexa este router específico à rota principal '/api'
    app.use('/api', router);
};
