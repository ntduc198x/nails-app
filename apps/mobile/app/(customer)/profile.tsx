import { Redirect } from "expo-router";

export default function CustomerProfileRedirect() {
  return <Redirect href="/(customer)/(tabs)/account" />;
}
