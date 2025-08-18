// backend/routes/adhesionRoutes.js

const express = require('express');

// A função agora recebe apenas 'app' e 'pool'
module.exports = function(app, pool) {
  const router = express.Router();

  // A função de autenticação é pega diretamente do app.locals
  const { authenticateToken } = app.locals;
  router.use(authenticateToken);

  // ROTA GET / (Buscar adesões com filtro e paginação)
  router.get('/', async (req, res) => {
    // CORREÇÃO AQUI: Alterado de 'nomeCliente' para 'nome_cliente' para corresponder ao frontend.
    const { 'nome_cliente': nomeCliente, matricula, comunidade, endereco, status_adesao: statusAdesao, limit, offset } = req.query;
    
    let whereClause = ' WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (nomeCliente) {
        whereClause += ` AND nome_cliente ILIKE $${paramIndex++}`;
        values.push(`%${nomeCliente}%`);
    }
    if (matricula) {
        whereClause += ` AND matricula ILIKE $${paramIndex++}`;
        values.push(`%${matricula}%`);
    }
    if (comunidade) {
        whereClause += ` AND comunidade ILIKE $${paramIndex++}`;
        values.push(`%${comunidade}%`);
    }
    if (endereco) {
        whereClause += ` AND endereco ILIKE $${paramIndex++}`;
        values.push(`%${endereco}%`);
    }
    if (statusAdesao) {
        // Corrigido para corresponder ao nome do campo no banco de dados, se necessário
        whereClause += ` AND status_adesao ILIKE $${paramIndex++}`;
        values.push(`%${statusAdesao}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM adesoes${whereClause}`;
    const countValues = [...values];

    let dataQuery = `SELECT * FROM adesoes${whereClause} ORDER BY matricula DESC`;

    const queryLimit = parseInt(limit) || 30;
    const queryOffset = parseInt(offset) || 0;

    dataQuery += ` LIMIT $${paramIndex++}`;
    values.push(queryLimit);

    dataQuery += ` OFFSET $${paramIndex++}`;
    values.push(queryOffset);

    try {
        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, values),
            pool.query(countQuery, countValues)
        ]);

        const totalCount = parseInt(countResult.rows[0].count, 10);
        const rows = dataResult.rows;
        const hasMore = (queryOffset + rows.length) < totalCount;

        res.status(200).json({ rows, hasMore, totalCount });
    } catch (error) {
        console.error('Erro ao buscar adesões:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar adesões.' });
    }
  });

  // ROTA PUT /:matricula (Atualizar uma adesão)
  router.put("/:matricula", async (req, res) => {
      const { matricula } = req.params;
      const fieldsToUpdate = req.body;

      delete fieldsToUpdate.id;
      delete fieldsToUpdate.matricula;

      const fieldNames = Object.keys(fieldsToUpdate);
      if (fieldNames.length === 0) {
          return res.status(400).json({ message: "Nenhum campo para atualizar." });
      }

      const setClauses = fieldNames.map((fieldName, index) => `${fieldName} = $${index + 1}`).join(", ");
      const queryParams = fieldNames.map(fieldName => fieldsToUpdate[fieldName]);
      queryParams.push(matricula);

      const queryText = `UPDATE adesoes SET ${setClauses} WHERE matricula = $${queryParams.length} RETURNING *`;

      try {
          const result = await pool.query(queryText, queryParams);
          if (result.rows.length === 0) {
              return res.status(404).json({ message: "Adesão não encontrada." });
          }
          res.status(200).json({ message: "Adesão atualizada com sucesso!", adhesion: result.rows[0] });
      } catch (err) {
          console.error("ERRO AO ATUALIZAR ADESÃO:", err.message);
          res.status(500).json({ message: "Erro interno do servidor ao atualizar adesão." });
      }
  });

  // ROTA DELETE /:matricula (Deletar uma adesão)
  router.delete("/:matricula", async (req, res) => {
    if (req.user.nivel_acesso !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem deletar." });
    }

    const { matricula } = req.params;

    if (!matricula) {
      return res.status(400).json({ message: "Matrícula é obrigatória para deletar." });
    }

    try {
      const queryText = "DELETE FROM adesoes WHERE matricula = $1";
      const result = await pool.query(queryText, [matricula]);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Adesão não encontrada." });
      }
      
      res.status(200).json({ message: "Adesão deletada com sucesso!" });

    } catch (err) {
      console.error("ERRO AO DELETAR ADESÃO:", err.message);
      res.status(500).json({ message: "Erro interno do servidor ao deletar adesão." });
    }
  });

  // Anexa o router ao 'app' principal com o prefixo correto
  app.use('/api/adhesions', router);
};
