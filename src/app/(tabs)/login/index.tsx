import { ThemedView } from "@/components/themed-view";
import { initDatabase, loginUser, saveSignedInUser } from "@/db/database";
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
  const [email, setEmail] = useState("");
  const [passwordHash, setPasswordHash] = useState("");
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    initDatabase();
  }, []);

  const handleLogin = async () => {
    try {
      const user = await loginUser(email.trim().toLowerCase(), passwordHash);

      if (user) {
        await saveSignedInUser(user);
        setEmail("");
        setPasswordHash("");
        router.replace("/");
      } else {
        console.log("Invalid email or password");
      }
    } catch (error) {
      console.log("Error:", error);
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
          value={passwordHash}
          onChangeText={setPasswordHash}
        />

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
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
