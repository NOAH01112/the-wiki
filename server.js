const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const app = express();
const config = require('./config.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

const db = new sqlite3.Database('wikidata.db');

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  author TEXT
)`);


app.get('/register', (req, res) => {
  res.send(`
    <h2>회원가입</h2>
    <form action="/register" method="post">
      <div>
        <label for="username">사용자 이름:</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div>
        <label for="password">비밀번호:</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit">가입</button>
    </form>
    <p>이미 계정이 있으신가요? <a href="/login">로그인</a></p>
  `);
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('비밀번호 해시 생성 중 오류가 발생했습니다.');
    }
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.run(sql, [username, hash], function(err) {
      if (err) {
        console.error(err.message);
        return res.status(500).send('사용자 등록 중 오류가 발생했습니다.');
      }
      res.redirect('/login');
    });
  });
});

app.get('/login', (req, res) => {
  res.send(`
    <h2>로그인</h2>
    <form action="/login" method="post">
      <div>
        <label for="username">사용자 이름:</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div>
        <label for="password">비밀번호:</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit">로그인</button>
    </form>
    <p>계정이 없으신가요? <a href="/register">회원가입</a></p>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.get(sql, [username], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (!row) {
      return res.status(401).send('사용자가 존재하지 않습니다.');
    }
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send('인증 중 오류가 발생했습니다.');
      }
      if (result) {
        req.session.username = username;
        res.redirect('/');
      } else {
        res.status(401).send('비밀번호가 일치하지 않습니다.');
      }
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  db.all('SELECT * FROM documents', (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (rows.length === 0) {
      return res.redirect('/create');
    }
    res.send(`
      <h2>문서 목록</h2>
      <ul>
        ${generateDocumentList(rows, req)}
      </ul>
      <p><a href="/create">새 문서 생성</a></p>
      <p><a href="/logout">로그아웃</a></p>
    `);
  });
});

// 문서 생성 페이지 라우트
app.get('/create', (req, res) => {
  // 로그인 확인
  if (!req.session.username) {
    return res.redirect('/login');
  }
  res.send(`
    <h2>새 문서 생성하기</h2>
    <form action="/create" method="post">
      <div>
        <label for="title">제목:</label>
        <input type="text" id="title" name="title" required>
      </div>
      <div>
        <label for="content">내용:</label>
        <textarea id="content" name="content" required></textarea>
      </div>
      <button type="submit">문서 생성</button>
    </form>
    <p><a href="/">문서 목록으로 돌아가기</a></p>
  `);
});

app.post('/create', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  const { title, content } = req.body;
  const sql = 'INSERT INTO documents (title, content, author) VALUES (?, ?, ?)';
  db.run(sql, [title, content, req.session.username], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 생성 중 오류가 발생했습니다.');
    }
    res.redirect(`/wiki/${this.lastID}`);
  });
});

app.get('/wiki/:id', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  const documentId = req.params.id;
  const sql = 'SELECT * FROM documents WHERE id = ?';
  db.get(sql, [documentId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (!row) {
      return res.status(404).send('문서를 찾을 수 없습니다.');
    }
    res.send(`
      <h2>${row.title}</h2>
      <p>${row.content}</p>
      <p><a href="/">문서 목록으로 돌아가기</a></p>
    `);
  });
});

app.get('/wiki/:id/edit', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  const documentId = req.params.id;
  const sql = 'SELECT * FROM documents WHERE id = ?';
  db.get(sql, [documentId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (!row) {
      return res.status(404).send('문서를 찾을 수 없습니다.');
    }
    res.send(`
      <h2>문서 편집</h2>
      <form action="/wiki/${documentId}/edit" method="post">
        <div>
          <label for="title">제목:</label>
          <input type="text" id="title" name="title" value="${row.title}" readonly>
        </div>
        <div>
          <label for="content">내용:</label>
          <textarea id="content" name="content" required>${row.content}</textarea>
        </div>
        <button type="submit">수정 완료</button>
      </form>
      <p><a href="/">문서 목록으로 돌아가기</a></p>
    `);
  });
});

app.post('/wiki/:id/edit', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  const documentId = req.params.id;
  const { content } = req.body;
  const sql = 'UPDATE documents SET content = ? WHERE id = ?';
  db.run(sql, [content, documentId], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 수정 중 오류가 발생했습니다.');
    }
    res.redirect(`/wiki/${documentId}`);
  });
});

app.get('/wiki/:id/delete', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  const documentId = req.params.id;
  const sql = 'DELETE FROM documents WHERE id = ?';
  db.run(sql, [documentId], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 삭제 중 오류가 발생했습니다.');
    }
    res.redirect('/');
  });
});

const port = config.port || 3000;

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
});

function generateDocumentList(rows, req) {
  let documentList = '';
  rows.forEach(row => {
    documentList += `
      <li>${row.title} 
        <a href="/wiki/${row.id}">보기</a> 
        <a href="/wiki/${row.id}/edit">편집</a> 
        <a href="/wiki/${row.id}/delete">삭제</a>
      </li>
    `;
  });
  return documentList;
}
