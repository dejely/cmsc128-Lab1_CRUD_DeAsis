export type Todo = {
  id: number;
  title: string;
  completed: number;
  dueDate: string | null;
  priority: "Low" | "Med" | "High";
  category: "School" | "Personal" | "Others";
};
