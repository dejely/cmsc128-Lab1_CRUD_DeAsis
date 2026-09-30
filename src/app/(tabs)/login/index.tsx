import { ThemedView } from "@/components/themed-view";
import { initDatabase, loginUser } from "@/db/database";
import { styles } from "@/styles/home.styles";
import { useEffect, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export default function Login() {
  useEffect(() => {
    initDatabase();
  }, []);

  const [email, setEmail] = useState("");
  const [password_hash, setPassword_Hash] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleLogin = async () => {
    try {
      const user = await loginUser(email.trim().toLowerCase(), password_hash);

      if (user) {
        console.log("Login Successful!");
        console.log("Welcome, ", user);
      } else {
        console.log("Invalid email or password");
      }

      setEmail("");
      setPassword_Hash("");
    } catch (e) {
      console.log("Error: ", e);
    }
  };

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
          placeholder="email"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Password"
          secureTextEntry
          value={password_hash}
          onChangeText={setPassword_Hash}
        />

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}
