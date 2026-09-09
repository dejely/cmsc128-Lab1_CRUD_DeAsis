import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const Task = (props) => {
  return (
    <View style={styles.todo}>
      <View style={styles.todoLeft}>
        <TouchableOpacity style={styles.bullet}></TouchableOpacity>
        <Text style={styles.todoText}>{props.text}</Text>
      </View>
      <View style={styles.checkbox}></View>
    </View>
  );
};

const styles = StyleSheet.create({
  todo: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todoLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  bullet: {
    width: 12,
    height: 12,
    backgroundColor: "#55BCF6",
    opacity: 0.4,
    borderRadius: 15,
    marginRight: 20,
  },
  todoText: {
    maxWidth: "80%",
  },
  checkbox: {
    width: 15,
    height: 15,
    borderColor: "#55BCF6",
    borderWidth: 2,
    borderRadius: 2,
  },
});

export default Task;
