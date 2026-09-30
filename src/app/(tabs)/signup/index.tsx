import { ThemedView } from "@/components/themed-view";
import { initDatabase } from "@/db/database";
import { styles } from "@/styles/home.styles";
import { useEffect, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";

export default function Login() {
  useEffect(() => {
    initDatabase();
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.taskWrapper,
          styles.taskFields,
          isLandscape && styles.landscapeWrapper,
        ]}
      >
        <TextInput
          style={styles.fieldInput}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
        />
      </View>
    </ThemedView>
  );
}
