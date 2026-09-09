import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
  undoBanner: {
    position: "absolute",
    bottom: 125,
    left: 20,
    right: 20,
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
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
  },
});
