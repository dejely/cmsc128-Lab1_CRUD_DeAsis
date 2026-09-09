import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EAED",
  },
  taskWrapper: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: "#E8EAED",
  },
  code: { textTransform: "uppercase" },
  taskFields: {
    gap: 6,
    marginBottom: 10,
  },
  fieldInput: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 15,
    borderColor: "#C0C0C0",
    borderWidth: 1,
  },
  option: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  selectedOption: {
    backgroundColor: "#93C5FD",
  },
  writeTaskWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    color: "#000000"
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
    borderColor: "#c0c0c0",
  },
  addText: {},
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  undoBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: "#333",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  undoText: {
    color: "#fff",
    fontWeight: "bold",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardWrapper: {
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
});
