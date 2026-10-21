class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function objectBody(body, keys) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key))) {
    throw new HttpError(400, "Invalid request fields");
  }
}

function text(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${name} must contain 1–${max} characters`);
  }
  return value.trim();
}

function credentials(body, signup = false) {
  objectBody(body, signup ? ["username", "email", "password"] : ["email", "password"]);
  const email = text(body.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address");
  }
  if (typeof body.password !== "string" || body.password.length < (signup ? 8 : 1) ||
      Buffer.byteLength(body.password) > 72 || (signup && !body.password.trim())) {
    throw new HttpError(400, "Password must contain at least 8 characters and at most 72 UTF-8 bytes");
  }
  return {
    email, password: body.password,
    ...(signup ? { username: text(body.username, "Username", 50) } : {}),
  };
}

function todoBody(body, partial = false) {
  const keys = ["title", "completed", "dueDate", "priority", "category"];
  objectBody(body, keys);
  if (!Object.keys(body).length) throw new HttpError(400, "Provide at least one task field");
  const result = {};
  if (!partial || Object.hasOwn(body, "title")) result.title = text(body.title, "Title", 200);
  if (!partial || Object.hasOwn(body, "completed")) {
    result.completed = body.completed === undefined && !partial ? 0 : body.completed;
    if (![0, 1].includes(result.completed)) throw new HttpError(400, "Completed must be 0 or 1");
  }
  if (!partial || Object.hasOwn(body, "dueDate")) {
    if (typeof body.dueDate !== "string" || !Number.isFinite(Date.parse(body.dueDate)) ||
        new Date(body.dueDate).toISOString() !== body.dueDate) {
      throw new HttpError(400, "Due date must be a valid ISO timestamp");
    }
    result.dueDate = body.dueDate;
  }
  for (const [key, values] of Object.entries({
    priority: ["Low", "Medium", "High"], category: ["School", "Personal", "Others"],
  })) {
    if (!partial || Object.hasOwn(body, key)) {
      if (!values.includes(body[key])) throw new HttpError(400, `Invalid ${key}`);
      result[key] = body[key];
    }
  }
  return result;
}

function taskId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(400, "Invalid task ID");
  }
  return Number(value);
}

module.exports = { HttpError, credentials, todoBody, taskId };
