import { getSignedInUser } from "@/db/database";
import Feather from "@expo/vector-icons/Feather";
import { Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";

export const unstable_settings = {
  initialRouteName: "signup",
};

export default function TabLayout() {
  const routeKey = useSegments().join("/");
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getSignedInUser()
      .then((user) => {
        if (isCurrent) setIsSignedIn(Boolean(user));
      })
      .catch(() => {
        if (isCurrent) setIsSignedIn(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [routeKey]);

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
          href: isSignedIn === false ? "/login" : null,
          title: "Login",
          tabBarIcon: ({ color, size }) => (
            <Feather name="log-in" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="signup"
        options={{
          title: "Sign up",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user-plus" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
