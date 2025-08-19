// ARQUIVO FINAL E INTEGRADO: backend/server.js

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Módulos de Rota (fábricas)
const authRoutesFactory = require("./routes/auth.js");
const adhesionRoutes = require("./routes/adhesionRoutes");
const csvUploadRoutes = require("./routes/csvUpload.js");

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
/*
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
*/


const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // A biblioteca 'pg' vai parsear isso automaticamente
  ssl: {
    rejectUnauthorized: false, // Ainda necessário para o Neon
  },
});

const authModule = authRoutesFactory(pool);

// MUDANÇA IMPORTANTE: Anexamos a função de autenticação ao app.locals
// Isso a torna disponível em toda a aplicação de forma segura.
app.locals.authenticateToken = authModule.authenticateToken;

app.use(cors());
app.use(express.json());

// Lógica de WebSockets (Socket.IO)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token not provided"));
  }
  const JWT_SECRET =
    process.env.JWT_SECRET || "sua_chave_secreta_muito_forte_e_aleatoria";
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
    socket.user = decoded;
    next();
  });
});

const onlineUsers = new Map();
io.on("connection", (socket) => {
  console.log(
    `Usuário conectado via WebSocket: ${socket.user.login_usuario} (ID: ${socket.user.id})`
  );
  onlineUsers.set(socket.user.id, socket.id);
  io.emit("update_online_users", Array.from(onlineUsers.keys()));

  socket.on("disconnect", () => {
    console.log(
      `Usuário desconectado do WebSocket: ${socket.user.login_usuario}`
    );
    onlineUsers.delete(socket.user.id);
    io.emit("update_online_users", Array.from(onlineUsers.keys()));
  });
});

// ====================================================================
// REGISTRO DAS ROTAS DA APLICAÇÃO
// ====================================================================

app.use("/", authModule.router);

// As chamadas agora são mais simples, sem passar a autenticação
adhesionRoutes(app, pool);
csvUploadRoutes(app, pool);


// ===== ROTAS PARA A TABELA DE CONFERÊNCIA (Mantidas no server.js) =====
app.get("/api/conferencia", app.locals.authenticateToken, async (req, res) => {
  const { matricula, endereco, comunidade, nomeCliente } = req.query;
  try {
    let queryText = `
          SELECT 
            a.matricula, a.nome_cliente, a.orgao_expedidor,
            c.equipe_conf, c.dt_conf, c.status_final, c.titularidade
          FROM adesoes a
          LEFT JOIN conferecnia c ON a.matricula = c.matricula
      `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (matricula) {
      conditions.push(`a.matricula ILIKE $${paramIndex++}`);
      values.push(`%${matricula}%`);
    }
    if (endereco) {
      conditions.push(`a.endereco ILIKE $${paramIndex++}`);
      values.push(`%${endereco}%`);
    }
    if (comunidade) {
      conditions.push(`a.comunidade ILIKE $${paramIndex++}`);
      values.push(`%${comunidade}%`);
    }
    if (nomeCliente) {
      conditions.push(`a.nome_cliente ILIKE $${paramIndex++}`);
      values.push(`%${nomeCliente}%`);
    }

    if (conditions.length > 0) {
      queryText += " WHERE " + conditions.join(" AND ");
    }
    queryText += " ORDER BY a.matricula";

    const result = await pool.query(queryText, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar dados da conferência com filtros:", err);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

app.put(
  "/api/conferencia/:matricula",
  app.locals.authenticateToken,
  async (req, res) => {
    const { matricula } = req.params;
    const {
      equipe_conf,
      dt_conf,
      status_final,
      entrega_cliente,
      alteracao_pendente,
      obs_programacao,
      dt_alteracao,
      titularidade,
      cpf_status,
    } = req.body;
    try {
      const queryText = `
          INSERT INTO conferecnia (matricula, equipe_conf, dt_conf, status_final, entrega_cliente, alteracao_pendente, obs_programacao, dt_alteracao, titularidade, cpf_status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (matricula) 
          DO UPDATE SET
            equipe_conf = EXCLUDED.equipe_conf, dt_conf = EXCLUDED.dt_conf, status_final = EXCLUDED.status_final,
            entrega_cliente = EXCLUDED.entrega_cliente, alteracao_pendente = EXCLUDED.alteracao_pendente,
            obs_programacao = EXCLUDED.obs_programacao, dt_alteracao = EXCLUDED.dt_alteracao,
            titularidade = EXCLUDED.titularidade, cpf_status = EXCLUDED.cpf_status
          RETURNING *;
      `;
      const values = [
        matricula,
        equipe_conf,
        dt_conf,
        status_final,
        entrega_cliente,
        alteracao_pendente,
        obs_programacao,
        dt_alteracao,
        titularidade,
        cpf_status,
      ];
      const result = await pool.query(queryText, values);
      res
        .status(200)
        .json({
          message: "Dados de conferência salvos com sucesso!",
          data: result.rows[0],
        });
    } catch (err) {
      console.error("Erro ao salvar dados da conferência:", err);
      res
        .status(500)
        .json({
          message: "Erro interno do servidor ao salvar dados da conferência.",
        });
    }
  }
);

// ===== ROTA PARA BUSCAR FOTOS DA NOVA LIGAÇÃO (Mantida no server.js) =====
app.get(
  "/api/fotos/:matricula",
  app.locals.authenticateToken,
  async (req, res) => {
    const { matricula } = req.params;
    try {
      const result = await pool.query(
        "SELECT fotos FROM nova_ligacao WHERE matricula = $1",
        [matricula]
      );
      if (result.rows.length > 0) {
        res.status(200).json(result.rows[0]);
      } else {
        res.status(200).json({ fotos: null });
      }
    } catch (err) {
      console.error("Erro ao buscar fotos:", err);
      res
        .status(500)
        .json({ message: "Erro interno do servidor ao buscar fotos." });
    }
  }
);
const path = require("path");

// Serve os arquivos estáticos do frontend React
app.use(express.static(path.join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// INICIA O SERVIDOR
server.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});
