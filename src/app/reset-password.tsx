import { ThemedView } from "@/components/themed-view";
import { confirmPasswordReset } from "@/services/api";
import { styles } from "@/styles/home.styles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleReset = async () => {
    if (!token) {
      setError("The reset link is missing its token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setError("");
      const response = await confirmPasswordReset(token, password);
      setMessage(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password reset failed.");
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
        <Text style={styles.title}>Choose a New Password</Text>

        <TextInput
          style={styles.fieldInput}
          placeholder="New password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {message ? (
          <Text style={{ color: "#166534" }}>{message}</Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {error}
          </Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Reset Password</Text>
        </Pressable>

        {message ? (
          <Pressable
            style={styles.accountLoginButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.accountLoginButtonText}>Back to Login</Text>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}
