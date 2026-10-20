import { ThemedView } from "@/components/themed-view";
import { requestPasswordReset } from "@/services/api";
import { styles } from "@/styles/home.styles";
import { Link } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleRequest = async () => {
    try {
      setError("");
      setMessage("");
      await requestPasswordReset(email.trim().toLowerCase());
      setMessage(
        "If that email is registered, a password reset link has been sent.",
      );
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to request a reset.");
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
        <Text style={styles.title}>Reset Password</Text>
        <Text>Enter the email associated with your account.</Text>

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {message ? (
          <Text style={{ color: "#166534" }}>{message}</Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {error}
          </Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleRequest}>
          <Text style={styles.buttonText}>Send Reset Link</Text>
        </Pressable>

        <Link href="/login" asChild>
          <Pressable style={styles.accountLoginButton}>
            <Text style={styles.accountLoginButtonText}>Back to Login</Text>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}
