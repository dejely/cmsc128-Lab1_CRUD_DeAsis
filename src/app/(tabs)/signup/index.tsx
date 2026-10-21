import { ThemedView } from "@/components/themed-view";
import { signUp, useSession } from "@/services/api";
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

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useSession();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleSignup = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const trimmedUsername = username.trim();
      const normalizedEmail = email.trim().toLowerCase();

      await signUp(trimmedUsername, normalizedEmail, password);
      setUsername("");
      setPassword("");
      setEmail("");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  if (session) return <Redirect href="/" />;

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
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text> : null}
        <Text>Use at least 8 characters. Long passwords with emoji or accented letters may exceed the length limit.</Text>
        <Pressable style={styles.button} onPress={handleSignup} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Creating account…" : "Sign Up"}</Text>
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
