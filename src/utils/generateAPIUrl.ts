import Constants from "expo-constants";

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

  if (process.env.NODE_ENV === "development") {
    let origin = "http://localhost:8081";

    // Try to get the host from expoConfig (preferred in newer Expo)
    if (Constants.expoConfig?.hostUri) {
      origin = `http://${Constants.expoConfig.hostUri}`;
    }
    // Fallback to experienceUrl if available (older Expo)
    else if (Constants.experienceUrl) {
      origin = Constants.experienceUrl.replace("exp://", "http://");
    }

    return origin.concat(path);
  }

  if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL environment variable is not defined"
    );
  }

  return process.env.EXPO_PUBLIC_API_BASE_URL.concat(path);
};
