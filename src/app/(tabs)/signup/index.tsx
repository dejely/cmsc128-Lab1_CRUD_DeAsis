import { useAuth } from "@/auth/AuthContext";
import { ThemedView } from "@/components/themed-view";
import { styles } from "@/styles/home.styles";
import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export default function Signup() {
  const router = useRouter();
  const { user, loading, registerAccount } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (loading) {
    return null;
  }

  if (user) {
    return <Redirect href="/" />;
  }
  const handleSignup = async () => {
    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !normalizedEmail || !password) {
      setError("Enter a username, email, and password.");
      return;
    }

    try {
      setError("");
      await registerAccount(trimmedUsername, normalizedEmail, password);
      setUsername("");
      setPassword("");
      setEmail("");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
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
          autoCapitalize="none"
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Password (8+ characters)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {error}
          </Text>
        ) : null}

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
