import { useAuth } from "@/auth/AuthContext";
import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";

export const unstable_settings = {
  initialRouteName: "login",
};

export default function TabLayout() {
  const { user, loading } = useAuth();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <Feather name="check-square" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          title: "Login",
          href: user || loading ? null : "/login",
          tabBarIcon: ({ color, size }) => (
            <Feather name="log-in" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: user && !loading ? "/profile" : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="signup"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
