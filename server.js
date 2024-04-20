const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 데이터베이스 연결
const db = new sqlite3.Database('wikidata.db');

// documents 테이블 생성
db.run(`CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT
)`);

// 문서 목록 템플릿 함수
function generateDocumentList(rows) {
  let documentList = '<h2>문서 목록</h2><ul>';
  rows.forEach(row => {
    documentList += `
      <li>
        <a href="/wiki/${row.id}">${row.title}</a>
        <a href="/wiki/${row.id}/edit">(편집)</a>
        <form action="/wiki/${row.id}/delete" method="post" style="display:inline;">
          <button type="submit">삭제</button>
        </form>
      </li>
    `;
  });
  documentList += '</ul>';
  return documentList;
}

// 문서 목록 페이지 라우트
app.get('/', (req, res) => {
  // 문서 목록을 데이터베이스에서 가져와서 확인
  db.all('SELECT * FROM documents', (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    // 문서가 없으면 바로 문서 생성 페이지로 이동
    if (rows.length === 0) {
      return res.redirect('/create');
    }
    // 문서 목록 표시
    res.send(generateDocumentList(rows));
  });
});

// 문서 생성 페이지 라우트
app.get('/create', (req, res) => {
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
  `);
});

// 문서 생성 처리 라우트
app.post('/create', (req, res) => {
  const { title, content } = req.body;
  // 문서를 데이터베이스에 추가
  const sql = 'INSERT INTO documents (title, content) VALUES (?, ?)';
  db.run(sql, [title, content], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 생성 중 오류가 발생했습니다.');
    }
    // 생성된 문서의 ID를 가져와서 해당 문서로 리다이렉트
    res.redirect(`/wiki/${this.lastID}`);
  });
});

// 문서 상세 페이지 라우트
app.get('/wiki/:id', (req, res) => {
  const documentId = req.params.id;
  // 문서 ID를 사용하여 해당 문서를 데이터베이스에서 가져옴
  const sql = 'SELECT * FROM documents WHERE id = ?';
  db.get(sql, [documentId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (!row) {
      return res.status(404).send('해당 문서를 찾을 수 없습니다.');
    }
    // 문서가 존재하면 문서 내용을 표시
    res.send(`
      <h2>${row.title}</h2>
      <p>${row.content}</p>
      <a href="/">문서 목록으로 돌아가기</a>
    `);
  });
});

// 문서 편집 페이지 라우트
app.get('/wiki/:id/edit', (req, res) => {
  const documentId = req.params.id;
  // 문서 ID를 사용하여 해당 문서를 데이터베이스에서 가져옴
  const sql = 'SELECT * FROM documents WHERE id = ?';
  db.get(sql, [documentId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('내부 서버 오류');
    }
    if (!row) {
      return res.status(404).send('해당 문서를 찾을 수 없습니다.');
    }
    // 문서가 존재하면 문서 편집 양식을 표시
    res.send(`
      <h2>문서 편집</h2>
      <form action="/wiki/${documentId}/edit" method="post">
        <div>
          <label for="title">제목:</label>
          <!-- 제목 입력 필드를 비활성화 -->
          <input type="text" id="title" name="title" value="${row.title}" required disabled>
        </div>
        <div>
          <label for="content">내용:</label>
          <textarea id="content" name="content" required>${row.content}</textarea>
        </div>
        <button type="submit">편집 완료</button>
      </form>
    `);
  });
});

// 문서 편집 처리 라우트
app.post('/wiki/:id/edit', (req, res) => {
  const documentId = req.params.id;
  const { title, content } = req.body;
  // 해당 문서를 데이터베이스에서 업데이트
  const sql = 'UPDATE documents SET content = ? WHERE id = ?';
  db.run(sql, [content, documentId], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 편집 중 오류가 발생했습니다.');
    }
    // 문서 편집 완료 후 해당 문서로 리다이렉트
    res.redirect(`/wiki/${documentId}`);
  });
});

// 문서 삭제 처리 라우트
app.post('/wiki/:id/delete', (req, res) => {
  const documentId = req.params.id;
  // 해당 문서를 데이터베이스에서 삭제
  const sql = 'DELETE FROM documents WHERE id = ?';
  db.run(sql, [documentId], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('문서 삭제 중 오류가 발생했습니다.');
    }
    // 문서 삭제 완료 후 문서 목록 페이지로 리다이렉트
    res.redirect('/');
  });
});

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
});
