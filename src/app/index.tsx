import { ThemedView } from "@/components/themed-view";
import Task from "@/components/todoButtons";
import { useState } from "react";
import {
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
  const [taskItems, setTaskItems] = useState<string[]>([]); // always infer that this is string else error
  const [checked, setChecked] = useState(false);

  const handleAddTask = () => {
    Keyboard.dismiss();
    setTaskItems([...taskItems, task]);
  };
  // ignore warning
  const completeTask = (index) => {
    let itemsCopy = [...taskItems];
    itemsCopy.splice(index, 1);
    setTaskItems(itemsCopy);
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
              <TouchableOpacity key={index} onPress={() => completeTask(index)}>
                <Task text={item} />
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
