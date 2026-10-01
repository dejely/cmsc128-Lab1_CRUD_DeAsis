import { ThemedView } from "@/components/themed-view";
import { createUser, initDatabase, saveSignedInUser } from "@/db/database";
import { styles } from "@/styles/home.styles";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export default function Login() {
  const router = useRouter();

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
      const trimmedUsername = username.trim();
      const normalizedEmail = email.trim().toLowerCase();

      await createUser(trimmedUsername, password_hash, normalizedEmail);
      await saveSignedInUser({
        username: trimmedUsername,
        email: normalizedEmail,
      });
      console.log("User Created");
      setUsername("");
      setPassword_Hash("");
      setEmail("");
      router.replace("/");
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

        <Link href="/(tabs)/login" asChild>
          <Pressable style={styles.accountLoginButton}>
            <Text style={styles.accountLoginButtonText}>
              Already have an account? Log in
            </Text>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}
