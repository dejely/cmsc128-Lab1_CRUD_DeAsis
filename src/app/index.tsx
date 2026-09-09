import { ThemedView } from "@/components/themed-view";
import Task from "@/components/todoButtons";
import { addTodo, deleteTodo, getTodos, initDatabase } from "@/db/database";
import type { Todo } from "@/db/todo";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const [task, setTask] = useState("");
  const [taskItems, setTaskItems] = useState<Todo[]>([]); // always infer that this is string else error

  useEffect(() => {
    async function loadTodos() {
      try {
        await initDatabase(); // init

        const savedTodos = await getTodos();
        setTaskItems(savedTodos);
      } catch (e) {
        console.error("failed to load todos", e);
      }

      loadTodos();
    }
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

  // ignore warning
  const confirmDeleteTask = (id: number) => {
    Alert.alert("Delete task", "Are you sure you want to delete this task?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTodo(id);

            const updatedTodos = await getTodos();
            setTaskItems(updatedTodos);
          } catch (e) {
            console.error("Failed to delete todo:", e);
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Title */}
      <View style={styles.taskWrapper}>
        <Text style={styles.title}>Today's Task</Text>

        <View>
          {/* Todo list here */}
          {taskItems.map((item, index) => {
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => confirmDeleteTask(item.id)}
              >
                <Task text={item.title} />
              </TouchableOpacity>
            );
            // get index for item key
          })}
        </View>
      </View>
      {/* Writing the user's task */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.writeTaskWrapper}
      >
        <TextInput
          style={styles.input}
          placeholder={"Write a task"}
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity onPress={() => handleAddTask()}>
          <View style={styles.addWrapper}>
            <Text style={styles.addText}>+</Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EAED",
  },
  taskWrapper: {
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: "#E8EAED",
  },
  code: { textTransform: "uppercase" },
  writeTaskWrapper: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    paddingVertical: 15,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderRadius: 15,
    borderColor: "#C0C0C0",
    borderWidth: 1,
  },
  addWrapper: {
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C0C0C0",
  },
  addText: {},
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
