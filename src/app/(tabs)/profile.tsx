import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/auth/AuthContext";
import { styles } from "@/styles/home.styles";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect } from "expo-router";

export default function Profile() {
  const { user, loading, updateProfile, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const handleSave = async () => {
    const nextUsername = username.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextUsername || !nextEmail) {
      Alert.alert("Profile", "Username and email are required.");
      return;
    }

    try {
      setSaving(true);
      await updateProfile(nextUsername, nextEmail);
      Alert.alert("Profile updated", "Your changes were saved.");
    } catch (e) {
      Alert.alert(
        "Update failed",
        e instanceof Error ? e.message : "Unable to update your profile.",
      );
    } finally {
      setSaving(false);
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
        <Text style={styles.title}>Profile</Text>

        <TextInput
          style={styles.fieldInput}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.fieldInput}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.button, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.accountLoginButton}
          onPress={() => void signOut()}
        >
          <Text style={styles.accountLoginButtonText}>Log out</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}
