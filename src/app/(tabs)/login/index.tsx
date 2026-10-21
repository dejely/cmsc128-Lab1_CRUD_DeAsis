import { ThemedView } from "@/components/themed-view";
import { signIn, useSession } from "@/services/api";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useSession();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleLogin = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim().toLowerCase(), password);
      setEmail("");
      setPassword("");
      router.replace("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
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
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
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

        {error ? <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={handleLogin} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Signing in…" : "Login"}</Text>
        </Pressable>

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
