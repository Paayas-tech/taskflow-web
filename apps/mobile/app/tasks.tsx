import { Redirect, type Href } from "expo-router";

export default function LegacyTasksRoute() {
  return <Redirect href={"/(tabs)/tasks" as Href} />;
}
