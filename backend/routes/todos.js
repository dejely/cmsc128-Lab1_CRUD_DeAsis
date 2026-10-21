const crypto = require("node:crypto");
const { HttpError, todoBody, taskId, objectBody } = require("../validation");

function registerTodoRoutes(app, { db, requireAuth }) {
const PRIORITIES = new Set(["Low", "Medium", "High"]);
const CATEGORIES = new Set(["School", "Personal", "Others"]);

function toApiTodo(row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    dueDate: row.due_date,
    priority: row.priority,
    category: row.category,
    clientId: row.client_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

function listTodos(userId, includeDeleted = false) {
  return db
    .prepare(`
      SELECT
        id, title, completed, due_date, priority, category,
        client_id, created_at, updated_at, version, deleted_at
      FROM todos
      WHERE user_id = ? AND (? OR deleted_at IS NULL)
      ORDER BY updated_at DESC, id DESC
    `)
    .all(userId, includeDeleted ? 1 : 0)
    .map(toApiTodo);
}

function validateTodoPayload(payload) {
  try {
    objectBody(payload, ["title", "completed", "dueDate", "priority", "category", "clientId"]);
    const { clientId, ...fields } = payload;
    todoBody(fields);
    return null;
  } catch (error) { return error.message; }
}

function normalizeUpdatedAt(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function saveOperationResult(userId, operationId, result) {
  db.prepare(`
    INSERT INTO sync_operations (user_id, operation_id, result_json)
    VALUES (?, ?, ?)
  `).run(userId, operationId, JSON.stringify(result));
}

function getSavedOperation(userId, operationId) {
  const row = db.prepare(`
    SELECT result_json
    FROM sync_operations
    WHERE user_id = ? AND operation_id = ?
  `).get(userId, operationId);

  return row ? JSON.parse(row.result_json) : null;
}

function applyOperation(userId, operation) {
  const { operationId, type, serverId, payload, updatedAt } = operation || {};

  if (!operationId || typeof operationId !== "string") {
    return { ok: false, error: "operationId is required." };
  }

  const normalizedUpdatedAt = normalizeUpdatedAt(updatedAt);
  if (!normalizedUpdatedAt) {
    return { ok: false, error: "updatedAt must be a valid ISO timestamp." };
  }

  const saved = getSavedOperation(userId, operationId);
  if (saved) return saved;

  if (type === "create") {
    const validationError = validateTodoPayload(payload);
    if (validationError) return { ok: false, error: validationError };

    const clientId = String(payload.clientId || "");
    if (!clientId) {
      return { ok: false, error: "clientId is required for create operations." };
    }

    const existing = db.prepare(`
      SELECT id, title, completed, due_date, priority, category,
             client_id, created_at, updated_at, version, deleted_at
      FROM todos
      WHERE user_id = ? AND client_id = ?
    `).get(userId, clientId);

    if (existing) {
      const result = {
        ok: true,
        operationId,
        applied: false,
        conflict: false,
        todo: toApiTodo(existing),
      };
      saveOperationResult(userId, operationId, result);
      return result;
    }

    const created = db.prepare(`
      INSERT INTO todos (
        user_id, title, completed, due_date, priority, category,
        client_id, created_at, updated_at, version, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    `).run(
      userId,
      payload.title.trim(),
      payload.completed ? 1 : 0,
      payload.dueDate ?? null,
      payload.priority,
      payload.category,
      clientId,
      normalizedUpdatedAt,
      normalizedUpdatedAt,
    );

    const row = db.prepare(`
      SELECT id, title, completed, due_date, priority, category,
             client_id, created_at, updated_at, version, deleted_at
      FROM todos WHERE id = ? AND user_id = ?
    `).get(created.lastInsertRowid, userId);

    const result = {
      ok: true,
      operationId,
      applied: true,
      conflict: false,
      todo: toApiTodo(row),
    };
    saveOperationResult(userId, operationId, result);
    return result;
  }

  if (type !== "update" && type !== "delete") {
    return { ok: false, error: "Unsupported sync operation." };
  }

  if (!Number.isInteger(Number(serverId))) {
    return {
      ok: true,
      operationId,
      applied: false,
      conflict: false,
      gone: true,
      todo: null,
    };
  }

  const current = db.prepare(`
    SELECT id, title, completed, due_date, priority, category,
           client_id, created_at, updated_at, version, deleted_at
    FROM todos
    WHERE id = ? AND user_id = ?
  `).get(Number(serverId), userId);

  if (!current) {
    const result = {
      ok: true,
      operationId,
      applied: false,
      conflict: false,
      gone: true,
      todo: null,
    };
    saveOperationResult(userId, operationId, result);
    return result;
  }

  // Deterministic last-write-wins: the later stored timestamp wins.
  // The timestamp is supplied by the client for offline edits and stored
  // unchanged on the server, allowing delayed offline writes to be ordered.
  if (new Date(normalizedUpdatedAt).getTime() <= new Date(current.updated_at).getTime()) {
    const result = {
      ok: true,
      operationId,
      applied: false,
      conflict: true,
      todo: toApiTodo(current),
    };
    saveOperationResult(userId, operationId, result);
    return result;
  }

  if (type === "delete") {
    db.prepare(`
      UPDATE todos
      SET deleted_at = ?,
          updated_at = ?,
          version = version + 1
      WHERE id = ? AND user_id = ?
    `).run(normalizedUpdatedAt, normalizedUpdatedAt, current.id, userId);
  } else {
    const validationError = validateTodoPayload(payload);
    if (validationError) return { ok: false, error: validationError };

    db.prepare(`
      UPDATE todos
      SET title = ?,
          completed = ?,
          due_date = ?,
          priority = ?,
          category = ?,
          updated_at = ?,
          version = version + 1,
          deleted_at = NULL
      WHERE id = ? AND user_id = ?
    `).run(
      payload.title.trim(),
      payload.completed ? 1 : 0,
      payload.dueDate ?? null,
      payload.priority,
      payload.category,
      normalizedUpdatedAt,
      current.id,
      userId,
    );
  }

  const row = db.prepare(`
    SELECT id, title, completed, due_date, priority, category,
           client_id, created_at, updated_at, version, deleted_at
    FROM todos WHERE id = ? AND user_id = ?
  `).get(current.id, userId);

  const result = {
    ok: true,
    operationId,
    applied: true,
    conflict: false,
    todo: toApiTodo(row),
  };
  saveOperationResult(userId, operationId, result);
  return result;
}

  app.get("/todos", requireAuth, (req, res) => {
    res.json({ todos: listTodos(req.userId) });
  });

  app.post("/todos/sync", requireAuth, (req, res, next) => {
    try {
      const operations = Array.isArray(req.body?.operations)
        ? req.body.operations
        : [];

      if (operations.length > 200) {
        return res.status(400).json({ error: "A maximum of 200 operations can be synced at once." });
      }

      const results = [];
      const transaction = db.transaction(() => {
        for (const operation of operations) {
          results.push(applyOperation(req.userId, operation));
        }
      });

      transaction();

      const hasErrors = results.some((result) => !result.ok);
      return res.status(hasErrors ? 207 : 200).json({
        results,
        todos: listTodos(req.userId, true),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/todos", requireAuth, (req, res, next) => {
    try {
      objectBody(req.body, ["title", "completed", "dueDate", "priority", "category", "clientId", "updatedAt"]);
      const { updatedAt: suppliedUpdatedAt, ...fields } = req.body;
      const payload = { completed: 0, ...fields };
      const validationError = validateTodoPayload(payload);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const clientId = payload.clientId === undefined ? crypto.randomUUID() : String(payload.clientId || "");
      if (!clientId) {
        return res.status(400).json({ error: "clientId is required." });
      }

      const updatedAt = normalizeUpdatedAt(suppliedUpdatedAt) || new Date().toISOString();

      const result = applyOperation(req.userId, {
        operationId: `direct-create-${clientId}`,
        type: "create",
        payload: {
          ...payload,
          clientId,
        },
        updatedAt,
      });

      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(201).json({ todo: result.todo });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/todos/:id", requireAuth, (req, res, next) => {
    try {
      const id = taskId(req.params.id);
      objectBody(req.body, ["title", "completed", "dueDate", "priority", "category", "updatedAt"]);
      const { updatedAt: suppliedUpdatedAt, ...patch } = req.body;
      todoBody(patch, true);
      const current = db.prepare(`
        SELECT id, title, completed, due_date, priority, category,
               client_id, created_at, updated_at, version, deleted_at
        FROM todos
        WHERE id = ? AND user_id = ?
      `).get(id, req.userId);

      if (!current || current.deleted_at) {
        return res.status(404).json({ error: "Todo not found." });
      }

      const body = req.body || {};
      const payload = {
        title: body.title ?? current.title,
        completed: body.completed ?? current.completed,
        dueDate: Object.hasOwn(body, "dueDate") ? body.dueDate : current.due_date,
        priority: body.priority ?? current.priority,
        category: body.category ?? current.category,
        clientId: current.client_id,
      };

      const result = applyOperation(req.userId, {
        operationId: crypto.randomUUID(),
        type: "update",
        serverId: Number(req.params.id),
        payload,
        updatedAt: suppliedUpdatedAt || new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString(),
      });

      if (!result.ok) return res.status(400).json({ error: result.error });

      return res.json({
        todo: result.todo,
        conflict: result.conflict,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/todos/:id", requireAuth, (req, res, next) => {
    try {
      const id = taskId(req.params.id);
      const current = db.prepare("SELECT updated_at FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(id, req.userId);
      if (!current) throw new HttpError(404, "Task not found");
      const result = applyOperation(req.userId, {
        operationId: crypto.randomUUID(),
        type: "delete",
        serverId: Number(req.params.id),
        payload: {},
        updatedAt: new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString(),
      });

      if (!result.ok) return res.status(400).json({ error: result.error });
      if (result.gone) return res.status(404).json({ error: "Todo not found." });

      return res.json({
        todo: result.todo,
        conflict: result.conflict,
      });
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = { registerTodoRoutes };
