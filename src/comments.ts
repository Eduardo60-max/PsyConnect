import { Database } from "bun:sqlite";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    postId TEXT NOT NULL,
    author TEXT NOT NULL,
    handle TEXT NOT NULL,
    body TEXT NOT NULL,
    time TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

export type DbComment = {
  id: string;
  postId: string;
  author: string;
  handle: string;
  body: string;
  time: string;
};

export function listComments(postId: string): DbComment[] {
  return db
    .query("SELECT id, postId, author, handle, body, time FROM comments WHERE postId = $postId ORDER BY createdAt ASC")
    .all({ $postId: postId }) as DbComment[];
}

export function addComment(comment: DbComment) {
  db.prepare(
    `INSERT INTO comments (id, postId, author, handle, body, time, createdAt)
     VALUES ($id, $postId, $author, $handle, $body, $time, $createdAt)`,
  ).run({
    $id: comment.id,
    $postId: comment.postId,
    $author: comment.author,
    $handle: comment.handle,
    $body: comment.body,
    $time: comment.time,
    $createdAt: Date.now(),
  });

  // mantém o contador do post em dia
  db.prepare("UPDATE posts SET comments = comments + 1 WHERE id = $id").run({ $id: comment.postId });
}