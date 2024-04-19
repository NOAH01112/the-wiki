// db.js

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('wikidata.db'); // 데이터베이스 이름 변경

// 사용자 테이블 생성
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT
)`);

// 위키 문서 테이블 생성
db.run(`CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  title TEXT,
  content TEXT
)`);

module.exports = db;
