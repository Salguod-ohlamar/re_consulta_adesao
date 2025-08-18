// backend/routes/csvUpload.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Cores para o console para facilitar a depuração
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

// Funções utilitárias (mantidas para consistência)
const formatDate = (val) => {
    if (!val) return null;
    const dateParts = val.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dateParts) {
        return `${dateParts[3]}-${dateParts[2].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
    }
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
};
const parseInteger = (val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
};
const parseFloatValue = (val) => {
    if (val === null || val === undefined || val === '') return null;
    // Substitui a vírgula por ponto para o formato numérico do SQL
    const num = parseFloat(String(val).replace(',', '.'));
    return isNaN(num) ? null : num;
};
const parseBoolean = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const lowerVal = String(val).toLowerCase();
    if (['true', '1', 'sim', 's', 'verdadeiro'].includes(lowerVal)) {
        return true;
    }
    if (['false', '0', 'nao', 'n', 'falso', 'não'].includes(lowerVal)) {
        return false;
    }
    return null; // Retorna nulo se não for um valor booleano reconhecido
};

// Função para detetar o separador
const detectSeparator = (buffer) => {
    const head = buffer.toString('utf8', 0, 500);
    const firstLine = head.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    if (semicolonCount > commaCount) {
        console.log(`${colors.cyan}INFO: Separador detetado: Ponto e vírgula (;)${colors.reset}`);
        return ';';
    }
    console.log(`${colors.cyan}INFO: Separador detetado: Vírgula (,)${colors.reset}`);
    return ',';
};

const upload = multer({ storage: multer.memoryStorage() });

// A função agora recebe apenas 'app' e 'pool'
module.exports = (app, pool) => {
    const router = express.Router();
    const { authenticateToken } = app.locals;

    // Protege a rota de upload
    router.use(authenticateToken);

    // Rota unificada para importar dados de um arquivo CSV
    router.post('/upload', upload.single('csvFile'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum ficheiro CSV enviado.' });
        }

        const { importType } = req.body;
        if (!importType || (importType !== 'adesoes' && importType !== 'nova_ligacao')) {
            return res.status(400).json({ message: 'Tipo de importação inválido. Use "adesoes" ou "nova_ligacao".' });
        }

        const fileBuffer = req.file.buffer;
        const results = [];
        const errors = [];
        let processedCount = 0;

        let targetTable = '';
        let dbColumns = [];
        let onConflictClause = '';

        if (importType === 'adesoes') {
            targetTable = 'adesoes';
            dbColumns = [
                'matricula', 'dt_envio', 'endereco', 'comunidade', 'tentativa_1', 'tentativa_2',
                'status_adesao', 'data_adesao', 'alt_serv', 'dt_atualiz_cad', 'dt_troca_tit',
                'dt_inclusao_cad', 'servico_alterado', 'validacao', 'pendencia', 'status_obra',
                'data_obra', 'status_termo', 'data_termo', 'nome_cliente', 'telefone', 'rg',
                'cpf', 'email', 'data_nasc', 'econ_res', 'econ_com', 'possui_cx_dagua',
                'relacao_imovel', 'alugado', 'tempo_moradia', 'n_adultos', 'n_criancas',
                'tipo_comercio', 'forma_esgotamento', 'obs_atividade', 'deseja_receb_info',
                'latitude', 'longitude'
            ];
            onConflictClause = `ON CONFLICT (matricula) DO UPDATE SET ${
                dbColumns.filter(col => col !== 'matricula').map(col => `${col} = EXCLUDED.${col}`).join(', ')
            }`;
        } else if (importType === 'nova_ligacao') {
            targetTable = 'nova_ligacao';
            dbColumns = ['matricula', 'codigo', 'bairro', 'latitude', 'longitude', 'fotos'];
            onConflictClause = `ON CONFLICT (matricula) DO UPDATE SET ${
                dbColumns.filter(col => col !== 'matricula').map(col => `${col} = EXCLUDED.${col}`).join(', ')
            }`;
        }

        const client = await pool.connect();
        try {
            const separator = detectSeparator(fileBuffer);

            await new Promise((resolve, reject) => {
                Readable.from(fileBuffer)
                    .pipe(csv({
                        separator: separator,
                        mapHeaders: ({ header }) => header
                            .trim()
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                            .replace(/\s*c\/\s*/g, ' ')      // Remove 'c/'
                            .replace(/[\s.]+/g, "_")         // Substitui espaços e pontos por underscore
                            .replace(/__/g, "_")             // Remove underscores duplicados
                            .replace(/^no_/, 'n_'),          // Ajusta 'no_adultos'
                        mapValues: ({ value }) => value.replace(/^"|"$/g, '').trim()
                    }))
                    .on('data', (data) => results.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });
            
            if (results.length === 0) {
                return res.status(400).json({ message: 'O ficheiro CSV está vazio ou mal formatado.' });
            }

            if (!results[0].hasOwnProperty('matricula')) {
                console.error(`${colors.bright}${colors.red}ERRO DE PARSING: A coluna 'matricula' não foi encontrada nos dados processados.${colors.reset}`);
                console.log(`${colors.yellow}Dados da primeira linha: ${JSON.stringify(results[0], null, 2)}${colors.reset}`);
                return res.status(400).json({ message: "Erro ao processar o ficheiro CSV. Verifique se a coluna 'matrícula' existe no ficheiro." });
            }

            await client.query('BEGIN');
            const valuePlaceholders = dbColumns.map((_, i) => `$${i + 1}`).join(', ');
            const insertQuery = `INSERT INTO ${targetTable} (${dbColumns.join(', ')}) VALUES (${valuePlaceholders}) ${onConflictClause}`;

            for (const row of results) {
                if (row.matricula && String(row.matricula).trim() !== '') {
                    const values = dbColumns.map(col => {
                        if (col === 'possui_cx_dagua' || col === 'deseja_receb_info' || col === 'alugado') {
                            return parseBoolean(row[col]);
                        }
                        if (col === 'latitude' || col === 'longitude') {
                            return parseFloatValue(row[col]);
                        }
                        if (col.startsWith('dt_') || col.endsWith('_data') || col === 'data_nasc') {
                            return formatDate(row[col]);
                        }
                        return row[col] || null;
                    });

                    try {
                        await client.query(insertQuery, values);
                        processedCount++;
                    } catch (dbError) {
                        errors.push(`Erro na linha com matrícula ${row.matricula}: ${dbError.message}`);
                        throw dbError; 
                    }
                }
            }

            await client.query('COMMIT');
            console.log(`${colors.green}SUCESSO: Transação concluída. ${processedCount} registos processados.${colors.reset}`);
            res.status(200).json({
                message: `Importação concluída! ${processedCount} registos processados.`,
                processed: processedCount,
                errors: errors
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`${colors.bright}${colors.red}ERRO GERAL NA IMPORTAÇÃO:${colors.reset}`, error);
            res.status(500).json({ message: 'Erro interno do servidor durante a importação.', error: error.message });
        } finally {
            client.release();
        }
    });

    // Anexa o router ao 'app' principal
    app.use('/api', router);
};
