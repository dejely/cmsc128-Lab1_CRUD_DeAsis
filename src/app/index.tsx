import { ThemedView } from "@/components/themed-view";
import Task from "@/components/todoButtons";
import {
  addTodo,
  deleteTodo,
  getTodos,
  initDatabase,
  updateTodo,
} from "@/db/database";
import type { Todo } from "@/db/todo";
import { styles } from "@/styles/home.styles";
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function HomeScreen() {
  const [task, setTask] = useState("");
  const [taskItems, setTaskItems] = useState<Todo[]>([]); // always infer that this is string else error
  const [deletedTask, setDeletedTask] = useState<Todo | null>(null); // our undo option can be null
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadTodos() {
      try {
        await initDatabase(); // init

        const savedTodos = await getTodos();
        setTaskItems(savedTodos);
      } catch (e) {
        console.error("failed to load todos", e);
      }
    }
    loadTodos();
  }, []);

  const handleAddTask = async () => {
    const trimmedTask = task.trim(); //trim for white spaces and nl

    if (trimmedTask.length === 0) {
      return;
    }

    try {
      Keyboard.dismiss();

      await addTodo(trimmedTask);

      const updatedTodos = await getTodos();
      setTaskItems(updatedTodos);

      setTask("");
    } catch (e) {
      console.error("Failed to add todo:", e);
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

  // ignore warning
  const handleDeleteTask = (id: number) => {
    const todo = taskItems.find((item) => item.id === id); //find tasks whos id matches it

    // if no task was found, stop.
    if (!todo) return;

    // remove it visually
    setTaskItems((items) => items.filter((item) => item.id !== id));
    setDeletedTask(todo);

    // reset an existing undo timer
    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
    }

    // Permanently delete after 3 seconds
    deleteTimer.current = setTimeout(async () => {
      try {
        await deleteTodo(todo.id);
        setDeletedTask(null);
      } catch (e) {
        console.error("Failed to delete todo:", e);
      }
    }, 3000);
  };

  const handleEditTask = (todo: Todo) => {
    setEditingId(todo.id);
    setTask(todo.title);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTask("");
  };

  const handleUpdateTask = async () => {
    const title = task.trim();
    if (editingId === null || title.length === 0) return; // not allowed

    try {
      await updateTodo(editingId, title); // call fn from db

      setTaskItems((items) =>
        items.map(
          (
            item, //iterate
          ) => (item.id === editingId ? { ...item, title } : item),
        ),
      );

      setEditingId(null);
      setTask("");
      Keyboard.dismiss(); // take away android keyboard
    } catch (e) {
      console.error("Failed to upload todo:", e);
      Alert.alert("Update failed", "Please try again.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Title */}
      <View style={styles.taskWrapper}>
        <Text style={styles.title}>Todo List</Text>
        <View>
          {/* Todo list here */}
          {taskItems.map((item) => (
            <View key={item.id} style={styles.taskRow}>
              <TouchableOpacity
                style={{ flex: 1 }}
                disabled={editingId !== null} // not must not be changed to null
                onPress={() => confirmDeleteTask(item.id)}
              >
                <Task text={item.title} />
              </TouchableOpacity>

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
        </View>
      </View>
      {/* Writing the user's task */}
      {deletedTask && (
        <View style={styles.undoBanner}>
          <Text style={{ color: "#fff" }}> Task Deleted</Text>

          <TouchableOpacity
            onPress={() => {
              const todo = deletedTask;
              if (!todo) return;

              // set it back
              if (deleteTimer.current !== null) {
                clearTimeout(deleteTimer.current);
                deleteTimer.current = null;
              }

              setTaskItems((items) => [...items, todo]); // Restore the deleted task
              setDeletedTask(null); // hide the banner after clicking
            }}
          >
            <Text style={styles.undoText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
      <KeyboardAvoidingView
        behavior="position"
        style={styles.keyboardWrapper}
        contentContainerStyle={styles.writeTaskWrapper}
      >
        <TextInput
          style={styles.input}
          placeholder={editingId !== null ? "Edit your task" : "Write a task"} // switch the labels if
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={editingId !== null ? "Save changes" : "Add task"}
          onPress={editingId !== null ? handleUpdateTask : handleAddTask} // so it could be dynamic
        >
          <View style={styles.addWrapper}>
            <Text style={styles.addText}>{editingId !== null ? "✓" : "+"}</Text>
          </View>
        </TouchableOpacity>

        {editingId !== null && (
          <TouchableOpacity onPress={handleCancelEdit}>
            <Text>Cancel</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
