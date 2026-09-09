import { ThemedView } from "@/components/themed-view";
import Task from "@/components/todoButtons";
import * as React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const [input, setInput] = React.useState("");
  const [checked, setChecked] = React.useState(false);

  return (
    <ThemedView style={styles.container}>
      {/* Title */}
      <View style={styles.taskWrapper}>
        <Text style={styles.title}>Today's Task</Text>

        <View>
          {/* Todo list here */}
          <Task text={"Task 1"} />
          <Task text={"Task 2"} />
        </View>
      </View>
      {/* Writing the user's task */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.writeTaskWrapper}
      >
        <TextInput style={styles.input} placeholder={"Write a task"} />
        <TouchableOpacity>
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
