import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { useSession } from "@/services/api";

export const unstable_settings = {
  initialRouteName: "signup",
};

export default function TabLayout() {
  const session = useSession();
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
          href: session ? null : "/login",
          tabBarIcon: ({ color, size }) => (
            <Feather name="log-in" size={size} color={color} />
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
