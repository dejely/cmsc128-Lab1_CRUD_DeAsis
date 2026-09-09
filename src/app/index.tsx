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
import DateTimePicker from "@expo/ui/community/datetime-picker";
import Feather from "@expo/vector-icons/Feather";
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
  const [task, setTask] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("Medium");
  const [category, setCategory] = useState<Todo["category"]>("Others");
  const [formError, setFormError] = useState("");
  const [taskItems, setTaskItems] = useState<Todo[]>([]); // always infer that this is string else error
  const [deletedTask, setDeletedTask] = useState<Todo | null>(null); // our undo option can be null
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false); // for the calendar ltr
  const [showTaskOptions, setShowTaskOptions] = useState(false);

  const hideTaskOptions = () => {
    setShowTaskOptions(false);
    setShowDatePicker(false);
    setFormError("");
    Keyboard.dismiss();
  };

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
    setShowTaskOptions(true);
    const trimmedTask = task.trim(); //trim for white spaces and nl

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

      const updatedTodos = await getTodos();
      setTaskItems(updatedTodos);

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
    // edits
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
        <ScrollView>
          {/* Todo list here */}
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
      <KeyboardAvoidingView behavior="position" style={styles.keyboardWrapper}>
        {editingId === null && showTaskOptions && (
          <View style={styles.taskFields}>
            {/*  collapses the buttons */}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={hideTaskOptions}
              style={{ alignSelf: "flex-end", paddingVertical: 6 }}
            >
              <Text style={{ color: "#2563EB" }}>Hide options</Text>
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
              if (editingId === null) setShowTaskOptions(true); // show the options
            }}
            placeholder={
              editingId !== null ? "Edit your task" : "What needs to be done?"
            } // switch the labels if
            value={task}
            onChangeText={(text) => setTask(text)}
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
                {" "}
                {editingId !== null ? "✓" : "+"}
              </Text>
            </View>
          </TouchableOpacity>

          {editingId !== null && (
            <TouchableOpacity onPress={handleCancelEdit}>
              <Text> Cancel </Text>
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
              const month = String(selectedDate.getMonth() + 1).padStart(
                2,
                "0",
              );
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
