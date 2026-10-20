import { request } from "@/services/api";
import type { Todo } from "./todo";

// Data now belongs to the authenticated server account. The legacy device
// database is left untouched and is never used as an authentication source.
export async function getTodos(): Promise<Todo[]> {
  return (await request<{ todos: Todo[] }>("/todos")).todos;
}

export async function addTodo(
  title: string,
  dueDate: string,
  priority: Todo["priority"],
  category: Todo["category"],
  completed = 0,
): Promise<Todo> {
  return (await request<{ todo: Todo }>("/todos", {
    method: "POST", body: JSON.stringify({ title, dueDate, priority, category, completed }),
  })).todo;
}

export async function deleteTodo(id: number): Promise<void> {
  await request<void>(`/todos/${id}`, { method: "DELETE" });
}

export async function updateTodo(id: number, title: string): Promise<Todo> {
  return (await request<{ todo: Todo }>(`/todos/${id}`, {
    method: "PATCH", body: JSON.stringify({ title }),
  })).todo;
}
