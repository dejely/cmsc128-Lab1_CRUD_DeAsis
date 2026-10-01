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

export default function Login() {
  const router = useRouter();
  const { user, loading, signInWithCredentials } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (loading) {
    return null;
  }

  if (user) {
    return <Redirect href="/" />;
  }

  const handleLogin = async () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      setError("Enter your username/email and password.");
      return;
    }

    try {
      setError("");
      await signInWithCredentials(trimmedIdentifier, password);
      setIdentifier("");
      setPassword("");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
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
          placeholder="Username or Email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {error}
          </Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>

        <Link href="/forgot-password" asChild>
          <Pressable style={styles.accountLoginButton}>
            <Text style={styles.accountLoginButtonText}>
              Forgot your password?
            </Text>
          </Pressable>
        </Link>

        <Link href="/(tabs)/signup" asChild>
          <Pressable style={styles.accountLoginButton}>
            <Text style={styles.accountLoginButtonText}>
              New to ToDo? Sign up
            </Text>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}
