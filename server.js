const crypto = require("crypto");

const sessions = {}; 

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/kepek", express.static("kepek"));

function auth(requiredRole = null) {
  return (req, res, next) => {
    const token = req.headers.authorization;

    if (!token || !sessions[token]) {
      return res.status(401).json({ message: "Nincs jogosultság" });
    }

    const user = sessions[token];

    if (requiredRole && user.role !== requiredRole) {
      return res.status(403).json({ message: "Nincs megfelelő jogosultság" });
    }

    req.user = user;
    next();
  };
}



app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const [[user]] = await db.query(
    'SELECT * FROM users WHERE username=? AND password=?',
    [username, password]
  );

  if (!user) {
    return res.status(401).json({ message: 'Hibás adatok' });
  }

  const token = require("crypto").randomBytes(16).toString("hex");

  sessions[token] = {
    id: user.id,
    username: user.username,   
    role: user.role
  };

  res.json({
    token,
    role: user.role
  });
});

/* ---- LISTA ---- */
app.get('/api/items', async (req, res) => {
  const [rows] = await db.query(`
    SELECT 
      t.ID_TETEL as id, 
      t.NEV as nev, 
      t.BESZ_EVE as leltari, 
      t.BESZ_FORRAS as gyari, 
      h.NEV as hely, 
      k.KATEGORIA as kategoria, 
      t.MENNYISEG as mennyiseg, 
      t.HIBAS as hibas
    FROM leltar_tetelek t 
    LEFT JOIN leltar_helyek h ON t.ID_HELY = h.ID_HELY 
    LEFT JOIN leltar_kategoriak k ON t.ID_KATEGORIA = k.ID_KATEGORIA 
  `);

  res.json(rows);
});


/* ---- ÚJ TÉTEL ---- */
app.post('/api/items', auth("admin"), async (req, res) => {
  const { nev, kategoria, mennyiseg } = req.body;

  const [[kat]] = await db.query(
    'SELECT ID_KATEGORIA FROM leltar_kategoriak WHERE KATEGORIA=?',
    [kategoria]
  );

  const [result] = await db.query(
    'INSERT INTO leltar_tetelek (NEV, ID_KATEGORIA, MENNYISEG) VALUES (?,?,?)',
    [nev, kat ? kat.ID_KATEGORIA : 1, mennyiseg]
  );

  res.json({ id: result.insertId });
});


/* ---- SELEJTEZÉS ---- */
app.delete('/api/items/:id', auth(), async (req, res) => {

  await db.query(
    'DELETE FROM leltar_tetelek WHERE ID_TETEL=?',
    [req.params.id]
  );

  res.sendStatus(200);
});

/* ---- SZERKESZTÉS ---- */
app.put('/api/items/:id', auth(), async (req, res) => {

  const { nev, mennyiseg } = req.body;

  await db.query(
    'UPDATE leltar_tetelek SET NEV=?, MENNYISEG=? WHERE ID_TETEL=?',
    [nev, mennyiseg, req.params.id]
  );

  res.sendStatus(200);
});


/* ---- HIBA ---- */
app.put('/api/items/:id/report', auth(), async (req, res) => {

  await db.query(
    'UPDATE leltar_tetelek SET HIBAS="Y" WHERE ID_TETEL=?',
    [req.params.id]
  );

  res.sendStatus(200);
});


/* ---- KÖLCSÖNZÉS ---- */
app.put('/api/items/:id/borrow', auth(), async (req, res) => {

  await db.query(`
    UPDATE leltar_tetelek
    SET 
      MENNYISEG = MENNYISEG - 1,
      KOLCSONZO = ?,
      KOLCSONZES_DATUMA = NOW()
    WHERE ID_TETEL = ? AND MENNYISEG > 0
  `, [req.user.username, req.params.id]);

  res.sendStatus(200);
});

/* ---- SAJÁT KÖLCSÖNZÉS ---- */
app.get('/api/my-borrowed', auth(), async (req, res) => {

  const [rows] = await db.query(`
    SELECT 
      ID_TETEL as id,
      NEV as nev,
      KOLCSONZES_DATUMA as datum
    FROM leltar_tetelek
    WHERE KOLCSONZO = ?
  `, [req.user.username]);

  res.json(rows);
});

/* ---- ÖSSZES KÖLCSÖNZÉS ---- */
app.get('/api/all-borrowed', auth("admin"), async (req, res) => {

  const [rows] = await db.query(`
    SELECT 
      ID_TETEL as id,
      NEV as nev,
      KOLCSONZO as kolcsonzo,
      KOLCSONZES_DATUMA as datum,
      MENNYISEG as maradek
    FROM leltar_tetelek
    WHERE KOLCSONZO IS NOT NULL
    ORDER BY KOLCSONZES_DATUMA DESC
  `);

  res.json(rows);
});




/* ---- VISSZAHOZ ---- */
app.put('/api/items/:id/return', auth(), async (req, res) => {

  const { role, username } = req.user;

  let query;
  let params;

  if (role === "admin") {
    // Admin bármit visszahozhat
    query = `
      UPDATE leltar_tetelek
      SET 
        MENNYISEG = MENNYISEG + 1,
        KOLCSONZO = NULL,
        KOLCSONZES_DATUMA = NULL
      WHERE ID_TETEL = ?
    `;
    params = [req.params.id];

  } else {
    // User csak a sajátját
    query = `
      UPDATE leltar_tetelek
      SET 
        MENNYISEG = MENNYISEG + 1,
        KOLCSONZO = NULL,
        KOLCSONZES_DATUMA = NULL
      WHERE ID_TETEL = ?
        AND KOLCSONZO = ?
    `;
    params = [req.params.id, username];
  }

  await db.query(query, params);

  res.sendStatus(200);
});



app.listen(9031, '0.0.0.0', () => {
  console.log("Server running on port 9031");
});
