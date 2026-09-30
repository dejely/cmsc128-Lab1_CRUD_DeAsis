import { ThemedView } from "@/components/themed-view";
import { createUser, initDatabase } from "@/db/database";
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

  const [username, setUsername] = useState("");
  const [password_hash, setPassword_Hash] = useState("");
  const [email, setEmail] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleSignup = async () => {
    try {
      await createUser(username, password_hash, email.trim());
      console.log("User Created");
      setUsername("");
      setPassword_Hash("");
      setEmail("");
    } catch (e) {
      console.log("Error:", e);
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
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Password"
          secureTextEntry
          value={password_hash}
          onChangeText={setPassword_Hash}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
        />

        <Pressable style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}
