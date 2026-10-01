import { ThemedView } from "@/components/themed-view";
import Task from "@/components/todoButtons";
import { useAuth } from "@/auth/AuthContext";
import {
  addTodo,
  deleteTodo,
  getTodos,
  initDatabase,
  restoreTodo,
  updateTodo,
} from "@/db/database";
import type { Todo } from "@/db/todo";
import { syncNow } from "@/db/sync";
import { styles } from "@/styles/home.styles";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import Feather from "@expo/vector-icons/Feather";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const { user, loading } = useAuth();

  const [task, setTask] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("Medium");
  const [category, setCategory] = useState<Todo["category"]>("Others");
  const [formError, setFormError] = useState("");
  const [taskItems, setTaskItems] = useState<Todo[]>([]);
  const [deletedTask, setDeletedTask] = useState<Todo | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTaskOptions, setShowTaskOptions] = useState(false);

  const hideTaskOptions = () => {
    setShowTaskOptions(false);
    setShowDatePicker(false);
    setFormError("");
    Keyboard.dismiss();
  };

  async function refreshLocalTodos() {
    const savedTodos = await getTodos();
    setTaskItems(savedTodos);
  }

  useEffect(() => {
    if (!user) {
      setTaskItems([]);
      return;
    }

    async function loadTodos() {
      try {
        await initDatabase();
        await syncNow();
        await refreshLocalTodos();
      } catch (e) {
        console.error("Failed to load todos", e);
      }
    }

    void loadTodos();
  }, [user?.id]);

  const handleAddTask = async () => {
    setShowTaskOptions(true);
    const trimmedTask = task.trim();

    if (trimmedTask.length === 0) {
      setFormError("Enter a title.");
      return;
    }

    const due = dueDate.trim();
    const date = new Date(`${due}T00:00:00`);
    const parts = due.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (
      !parts ||
      date.getFullYear() !== Number(parts[1]) ||
      date.getMonth() + 1 !== Number(parts[2]) ||
      date.getDate() !== Number(parts[3])
    ) {
      setFormError("Enter a valid due date and time: YYYY-MM-DD.");
      return;
    }

    try {
      setFormError("");
      Keyboard.dismiss();

      await addTodo(trimmedTask, date.toISOString(), priority, category);
      await refreshLocalTodos();
      void syncNow();

      setTask("");
      setDueDate("");
      setPriority("Medium");
      setCategory("Others");
      hideTaskOptions();
    } catch (e) {
      console.error("Failed to add todo:", e);
      setFormError("Failed to add task. Please try again.");
    }
  };

  const confirmDeleteTask = (id: number) => {
    Alert.alert("Delete task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteTask(id),
      },
    ]);
  };

  const handleDeleteTask = (id: number) => {
    const todo = taskItems.find((item) => item.id === id);
    if (!todo) return;

    setTaskItems((items) => items.filter((item) => item.id !== id));
    setDeletedTask(todo);

    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
    }

    deleteTimer.current = setTimeout(async () => {
      try {
        await deleteTodo(todo.id);
        setDeletedTask(null);
        void syncNow();
      } catch (e) {
        console.error("Failed to delete todo:", e);
      }
    }, 3000);
  };

  const handleEditTask = (todo: Todo) => {
    hideTaskOptions();
    setFormError("");
    setEditingId(todo.id);
    setTask(todo.title);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTask("");
  };

  const handleUpdateTask = async () => {
    const title = task.trim();
    if (editingId === null || title.length === 0) return;

    try {
      await updateTodo(editingId, title);

      setTaskItems((items) =>
        items.map((item) =>
          item.id === editingId ? { ...item, title } : item,
        ),
      );

      setEditingId(null);
      setTask("");
      Keyboard.dismiss();
      void syncNow();
    } catch (e) {
      console.error("Failed to update todo:", e);
      Alert.alert("Update failed", "Please try again.");
    }
  };

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.taskWrapper}>
        <Text style={styles.title}>Todo List</Text>
        <ScrollView>
          {taskItems.map((item) => (
            <View key={item.id} style={styles.taskRow}>
              <TouchableOpacity
                style={{ flex: 1 }}
                disabled={editingId !== null}
                onPress={() => confirmDeleteTask(item.id)}
              >
                <Task text={item.title} />
              </TouchableOpacity>

              <View
                style={{
                  maxWidth: "45%",
                  alignItems: "flex-end",
                  gap: 0,
                  backgroundColor: "#fff",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 15,
                  borderColor: "#C0C0C",
                  alignContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 12, color: "#555", textAlign: "right" }}
                >
                  Due date:{" "}
                  {item.dueDate
                    ? new Date(item.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                    : "Not set"}
                </Text>
                <Text
                  style={{ fontSize: 12, color: "#555", textAlign: "right" }}
                >
                  {item.priority} · {item.category}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.editButton}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.title}`}
                onPress={() => handleEditTask(item)}
              >
                <Feather name="edit-2" size={22} color="#2563EB" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {deletedTask && (
        <View style={styles.undoBanner}>
          <Text style={{ color: "#fff" }}>Task Deleted</Text>

          <TouchableOpacity
            onPress={async () => {
              const todo = deletedTask;
              if (!todo) return;

              if (deleteTimer.current !== null) {
                clearTimeout(deleteTimer.current);
                deleteTimer.current = null;
              }

              try {
                await restoreTodo(todo);
                await refreshLocalTodos();
                setDeletedTask(null);
                void syncNow();
              } catch (e) {
                console.error("Failed to restore todo:", e);
              }
            }}
          >
            <Text style={styles.undoText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior="position" style={styles.keyboardWrapper}>
        {editingId === null && showTaskOptions && (
          <View style={styles.taskFields}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={hideTaskOptions}
              style={{ alignSelf: "flex-end", paddingVertical: 6 }}
            >
              <Text style={{ color: "#2563EB" }}>v</Text>
            </TouchableOpacity>

            <Text>Priority</Text>
            <View style={styles.writeTaskWrapper}>
              {(["Low", "Medium", "High"] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: priority === value }}
                  onPress={() => setPriority(value)}
                  style={[
                    styles.option,
                    priority === value && styles.selectedOption,
                  ]}
                >
                  <Text>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text>Tag/category</Text>
            <View style={styles.writeTaskWrapper}>
              {(["School", "Personal", "Others"] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === value }}
                  onPress={() => setCategory(value)}
                  style={[
                    styles.option,
                    category === value && styles.selectedOption,
                  ]}
                >
                  <Text>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {formError ? (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {formError}
          </Text>
        ) : null}

        <View style={styles.writeTaskWrapper}>
          <TextInput
            style={styles.input}
            accessibilityLabel="Title"
            onFocus={() => {
              if (editingId === null) setShowTaskOptions(true);
            }}
            placeholder={
              editingId !== null ? "Edit your task" : "What needs to be done?"
            }
            value={task}
            onChangeText={setTask}
          />

          {editingId === null && showTaskOptions && (
            <TouchableOpacity
              style={[styles.fieldInput, { width: 125 }]}
              accessibilityRole="button"
              accessibilityLabel="Select due date"
              onPress={() => {
                Keyboard.dismiss();
                setShowDatePicker(true);
              }}
            >
              <Text>{dueDate || "📅 Due date"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              editingId !== null ? "Save changes" : "Add task"
            }
            onPress={editingId !== null ? handleUpdateTask : handleAddTask}
          >
            <View style={styles.addWrapper}>
              <Text style={styles.addText}>
                {editingId !== null ? "✓" : "+"}
              </Text>
            </View>
          </TouchableOpacity>

          {editingId !== null && (
            <TouchableOpacity onPress={handleCancelEdit}>
              <Text>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {editingId === null && showTaskOptions && showDatePicker && (
          <DateTimePicker
            value={dueDate ? new Date(`${dueDate}T00:00:00`) : new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            presentation="dialog"
            onDismiss={() => setShowDatePicker(false)}
            onValueChange={(_, selectedDate) => {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
              const day = String(selectedDate.getDate()).padStart(2, "0");

              setDueDate(`${year}-${month}-${day}`);
              setFormError("");
              setShowDatePicker(false);
            }}
          />
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
